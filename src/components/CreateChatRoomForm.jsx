import React, { useState } from 'react';
import './CreateChatRoomForm.css';

const CreateChatRoomForm = ({ onRoomCreated, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isPrivate: false
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Room name is required';
        } else if (formData.name.length < 3) {
            newErrors.name = 'Room name must be at least 3 characters';
        } else if (formData.name.length > 30) {
            newErrors.name = 'Room name must be less than 30 characters';
        } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name)) {
            newErrors.name = 'Room name can only contain letters, numbers, spaces, hyphens, and underscores';
        }

        if (formData.description && formData.description.length > 200) {
            newErrors.description = 'Description must be less than 200 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setErrors({});

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    isPrivate: formData.isPrivate
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Reset form
                setFormData({ name: '', description: '', isPrivate: false });
                
                // Notify parent component
                if (onRoomCreated) {
                    onRoomCreated(data.room);
                }
            } else {
                setErrors({ submit: data.error || 'Failed to create room' });
            }
        } catch (error) {
            console.error('Error creating room:', error);
            setErrors({ submit: 'Network error. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="create-room-overlay">
            <div className="create-room-modal">
                <div className="create-room-header">
                    <h3>
                        <i className="fas fa-plus-circle"></i>
                        Create New Chat Room
                    </h3>
                    <button 
                        className="close-btn" 
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="create-room-form">
                    {errors.submit && (
                        <div className="error-message">
                            <i className="fas fa-exclamation-circle"></i>
                            {errors.submit}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">
                            <i className="fas fa-hashtag"></i>
                            Room Name *
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className={errors.name ? 'error' : ''}
                            placeholder="Enter room name"
                            disabled={isLoading}
                            maxLength={30}
                        />
                        {errors.name && (
                            <span className="field-error">{errors.name}</span>
                        )}
                        <small className="char-count">
                            {formData.name.length}/30 characters
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">
                            <i className="fas fa-info-circle"></i>
                            Description
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className={errors.description ? 'error' : ''}
                            placeholder="Enter room description (optional)"
                            disabled={isLoading}
                            maxLength={200}
                            rows={3}
                        />
                        {errors.description && (
                            <span className="field-error">{errors.description}</span>
                        )}
                        <small className="char-count">
                            {formData.description.length}/200 characters
                        </small>
                    </div>

                    <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="isPrivate"
                                checked={formData.isPrivate}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                            <span className="checkmark"></span>
                            <div className="checkbox-content">
                                <strong>Private Room</strong>
                                <small>Only invited members can join this room</small>
                            </div>
                        </label>
                    </div>

                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={onCancel}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={isLoading || !formData.name.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-plus"></i>
                                    Create Room
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateChatRoomForm;
