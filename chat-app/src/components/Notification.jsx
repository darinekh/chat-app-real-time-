import React, { useState, useEffect } from 'react';
import './Notification.css';

const Notification = ({ 
    type = 'info', 
    title, 
    message, 
    duration = 5000, 
    onClose,
    position = 'top-right',
    showIcon = true,
    closable = true 
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                handleClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, 300);
    };

    const getIcon = () => {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    };

    if (!isVisible) return null;

    return (
        <div className={`notification notification-${type} notification-${position} ${isExiting ? 'notification-exit' : ''}`}>
            <div className="notification-content">
                {showIcon && (
                    <div className="notification-icon">
                        <i className={getIcon()}></i>
                    </div>
                )}
                <div className="notification-body">
                    {title && <div className="notification-title">{title}</div>}
                    <div className="notification-message">{message}</div>
                </div>
                {closable && (
                    <button className="notification-close" onClick={handleClose}>
                        <i className="fas fa-times"></i>
                    </button>
                )}
            </div>
            {duration > 0 && (
                <div 
                    className="notification-progress" 
                    style={{ animationDuration: `${duration}ms` }}
                ></div>
            )}
        </div>
    );
};

// Notification Container for managing multiple notifications
export const NotificationContainer = ({ notifications = [], position = 'top-right' }) => {
    return (
        <div className={`notification-container notification-container-${position}`}>
            {notifications.map((notification, index) => (
                <Notification
                    key={notification.id || index}
                    {...notification}
                    position={position}
                />
            ))}
        </div>
    );
};

export default Notification;
