import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
    size = 'md', 
    color = 'primary', 
    text = '', 
    fullScreen = false,
    className = '' 
}) => {
    const sizeClasses = {
        xs: 'spinner-xs',
        sm: 'spinner-sm',
        md: 'spinner-md',
        lg: 'spinner-lg',
        xl: 'spinner-xl'
    };

    const colorClasses = {
        primary: 'spinner-primary',
        secondary: 'spinner-secondary',
        white: 'spinner-white',
        gray: 'spinner-gray'
    };

    const spinnerClass = `loading-spinner ${sizeClasses[size]} ${colorClasses[color]} ${className}`;

    if (fullScreen) {
        return (
            <div className="loading-overlay">
                <div className="loading-content">
                    <div className={spinnerClass}>
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                        <div className="spinner-ring"></div>
                    </div>
                    {text && <p className="loading-text">{text}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="loading-inline">
            <div className={spinnerClass}>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
            </div>
            {text && <span className="loading-text">{text}</span>}
        </div>
    );
};

export default LoadingSpinner;
