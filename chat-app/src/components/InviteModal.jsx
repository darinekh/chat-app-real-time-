import React, { useState } from 'react';
import './InviteModal.css';

const InviteModal = ({ isOpen, onClose, room, onInviteCreated }) => {
    const [inviteType, setInviteType] = useState('code');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [expiresInHours, setExpiresInHours] = useState(24);
    const [usageLimit, setUsageLimit] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [createdInvite, setCreatedInvite] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/invitations/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    roomId: room._id,
                    type: inviteType,
                    invitedUsername: inviteType === 'direct' ? username : undefined,
                    invitedEmail: inviteType === 'email' ? email : undefined,
                    message,
                    expiresInHours,
                    usageLimit: inviteType === 'code' ? usageLimit : 1
                })
            });

            const data = await response.json();

            if (response.ok) {
                setCreatedInvite(data.invitation);
                onInviteCreated && onInviteCreated(data.invitation);
            } else {
                setError(data.error || 'Failed to create invitation');
            }
        } catch (error) {
            console.error('Error creating invitation:', error);
            setError('Failed to create invitation');
        } finally {
            setLoading(false);
        }
    };

    const copyInviteLink = () => {
        if (createdInvite) {
            navigator.clipboard.writeText(createdInvite.inviteUrl);
            // You could add a toast notification here
        }
    };

    const resetForm = () => {
        setInviteType('code');
        setUsername('');
        setEmail('');
        setMessage('');
        setExpiresInHours(24);
        setUsageLimit(1);
        setError('');
        setCreatedInvite(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="invite-modal-overlay">
            <div className="invite-modal">
                <div className="invite-modal-header">
                    <h3>Invite to {room?.name}</h3>
                    <button className="close-btn" onClick={handleClose}>×</button>
                </div>

                {!createdInvite ? (
                    <form onSubmit={handleSubmit} className="invite-form">
                        <div className="form-group">
                            <label>Invitation Type:</label>
                            <select 
                                value={inviteType} 
                                onChange={(e) => setInviteType(e.target.value)}
                                className="form-select"
                            >
                                <option value="code">Shareable Link</option>
                                <option value="direct">Direct User Invite</option>
                                <option value="email">Email Invite</option>
                            </select>
                        </div>

                        {inviteType === 'direct' && (
                            <div className="form-group">
                                <label>Username:</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username"
                                    required
                                    className="form-input"
                                />
                            </div>
                        )}

                        {inviteType === 'email' && (
                            <div className="form-group">
                                <label>Email:</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter email address"
                                    required
                                    className="form-input"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Personal Message (optional):</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Add a personal message..."
                                maxLength={200}
                                className="form-textarea"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Expires in (hours):</label>
                                <select 
                                    value={expiresInHours} 
                                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                                    className="form-select"
                                >
                                    <option value={1}>1 hour</option>
                                    <option value={6}>6 hours</option>
                                    <option value={24}>24 hours</option>
                                    <option value={72}>3 days</option>
                                    <option value={168}>1 week</option>
                                </select>
                            </div>

                            {inviteType === 'code' && (
                                <div className="form-group">
                                    <label>Usage Limit:</label>
                                    <select 
                                        value={usageLimit} 
                                        onChange={(e) => setUsageLimit(Number(e.target.value))}
                                        className="form-select"
                                    >
                                        <option value={1}>1 use</option>
                                        <option value={5}>5 uses</option>
                                        <option value={10}>10 uses</option>
                                        <option value={25}>25 uses</option>
                                        <option value={100}>100 uses</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="form-actions">
                            <button type="button" onClick={handleClose} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading} className="btn-primary">
                                {loading ? 'Creating...' : 'Create Invitation'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="invite-success">
                        <h4>Invitation Created Successfully!</h4>
                        <div className="invite-details">
                            <p><strong>Room:</strong> {createdInvite.room.name}</p>
                            <p><strong>Type:</strong> {createdInvite.type}</p>
                            <p><strong>Expires:</strong> {new Date(createdInvite.expiresAt).toLocaleString()}</p>
                            {createdInvite.usageLimit > 1 && (
                                <p><strong>Usage Limit:</strong> {createdInvite.usageLimit}</p>
                            )}
                        </div>
                        
                        <div className="invite-link-section">
                            <label>Invitation Link:</label>
                            <div className="invite-link-container">
                                <input 
                                    type="text" 
                                    value={createdInvite.inviteUrl} 
                                    readOnly 
                                    className="invite-link-input"
                                />
                                <button onClick={copyInviteLink} className="copy-btn">
                                    Copy
                                </button>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button onClick={handleClose} className="btn-primary">
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InviteModal;
