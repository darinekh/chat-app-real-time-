import React from 'react';
import './Avatar.css';

const Avatar = ({ 
    src, 
    alt, 
    name, 
    size = 'md', 
    status = null, 
    className = '',
    onClick,
    showBorder = false,
    fallbackColor = 'primary'
}) => {
    const sizeClasses = {
        xs: 'avatar-xs',
        sm: 'avatar-sm',
        md: 'avatar-md',
        lg: 'avatar-lg',
        xl: 'avatar-xl',
        '2xl': 'avatar-2xl'
    };

    const statusClasses = {
        online: 'avatar-status-online',
        offline: 'avatar-status-offline',
        away: 'avatar-status-away',
        busy: 'avatar-status-busy'
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getColorFromName = (name) => {
        if (!name) return 'var(--primary-500)';
        
        const colors = [
            'var(--primary-500)',
            'var(--secondary-500)',
            'var(--success-500)',
            'var(--warning-500)',
            '#8b5cf6', // purple
            '#06b6d4', // cyan
            '#10b981', // emerald
            '#f59e0b', // amber
            '#ef4444', // red
            '#3b82f6', // blue
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    };

    const avatarClasses = [
        'avatar',
        sizeClasses[size],
        showBorder ? 'avatar-bordered' : '',
        onClick ? 'avatar-clickable' : '',
        className
    ].filter(Boolean).join(' ');

    const handleClick = () => {
        if (onClick) onClick();
    };

    return (
        <div className={avatarClasses} onClick={handleClick}>
            <div className="avatar-inner">
                {src ? (
                    <img 
                        src={src} 
                        alt={alt || name || 'Avatar'} 
                        className="avatar-image"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div 
                    className="avatar-fallback"
                    style={{ 
                        backgroundColor: getColorFromName(name),
                        display: src ? 'none' : 'flex'
                    }}
                >
                    {getInitials(name)}
                </div>
            </div>
            
            {status && (
                <div className={`avatar-status ${statusClasses[status]}`}>
                    <div className="avatar-status-dot"></div>
                </div>
            )}
        </div>
    );
};

// Avatar Group Component
export const AvatarGroup = ({ 
    avatars = [], 
    max = 3, 
    size = 'md', 
    className = '',
    showMore = true 
}) => {
    const visibleAvatars = avatars.slice(0, max);
    const remainingCount = avatars.length - max;

    return (
        <div className={`avatar-group avatar-group-${size} ${className}`}>
            {visibleAvatars.map((avatar, index) => (
                <Avatar
                    key={avatar.id || index}
                    {...avatar}
                    size={size}
                    className="avatar-group-item"
                />
            ))}
            
            {showMore && remainingCount > 0 && (
                <div className={`avatar avatar-${size} avatar-more`}>
                    <div className="avatar-inner">
                        <div className="avatar-fallback avatar-more-fallback">
                            +{remainingCount}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Avatar;
