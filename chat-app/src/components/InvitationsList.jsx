import React, { useState, useEffect } from 'react';
import './InvitationsList.css';

const InvitationsList = ({ user }) => {
    const [receivedInvitations, setReceivedInvitations] = useState([]);
    const [sentInvitations, setSentInvitations] = useState([]);
    const [activeTab, setActiveTab] = useState('received');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            fetchInvitations();
        }
    }, [user]);

    const fetchInvitations = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            
            // Fetch received invitations
            const receivedResponse = await fetch('/api/invitations/received', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Fetch sent invitations
            const sentResponse = await fetch('/api/invitations/sent', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (receivedResponse.ok && sentResponse.ok) {
                const receivedData = await receivedResponse.json();
                const sentData = await sentResponse.json();
                
                setReceivedInvitations(receivedData.invitations || []);
                setSentInvitations(sentData.invitations || []);
            } else {
                setError('Failed to fetch invitations');
            }
        } catch (error) {
            console.error('Error fetching invitations:', error);
            setError('Failed to fetch invitations');
        } finally {
            setLoading(false);
        }
    };

    const acceptInvitation = async (inviteCode) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/invitations/${inviteCode}/accept`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Remove the accepted invitation from the list
                setReceivedInvitations(prev => 
                    prev.filter(inv => inv.inviteCode !== inviteCode)
                );
                
                // You might want to trigger a room list refresh here
                // or redirect to the joined room
                alert(`Successfully joined ${data.room.name}!`);
            } else {
                alert(data.error || 'Failed to accept invitation');
            }
        } catch (error) {
            console.error('Error accepting invitation:', error);
            alert('Failed to accept invitation');
        }
    };

    const revokeInvitation = async (invitationId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/invitations/${invitationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Remove the revoked invitation from the list
                setSentInvitations(prev => 
                    prev.filter(inv => inv._id !== invitationId)
                );
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to revoke invitation');
            }
        } catch (error) {
            console.error('Error revoking invitation:', error);
            alert('Failed to revoke invitation');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const getStatusBadge = (invitation) => {
        const now = new Date();
        const expiresAt = new Date(invitation.expiresAt);
        
        if (expiresAt < now) {
            return <span className="status-badge expired">Expired</span>;
        }
        
        if (invitation.usedCount >= invitation.usageLimit) {
            return <span className="status-badge used">Used</span>;
        }
        
        return <span className="status-badge active">Active</span>;
    };

    if (!user) return null;

    return (
        <div className="invitations-container">
            <div className="invitations-header">
                <h3>Invitations</h3>
                <div className="tab-buttons">
                    <button 
                        className={`tab-btn ${activeTab === 'received' ? 'active' : ''}`}
                        onClick={() => setActiveTab('received')}
                    >
                        Received ({receivedInvitations.length})
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sent')}
                    >
                        Sent ({sentInvitations.length})
                    </button>
                </div>
            </div>

            {loading && <div className="loading">Loading invitations...</div>}
            {error && <div className="error-message">{error}</div>}

            {activeTab === 'received' && (
                <div className="invitations-list">
                    {receivedInvitations.length === 0 ? (
                        <div className="no-invitations">No pending invitations</div>
                    ) : (
                        receivedInvitations.map(invitation => (
                            <div key={invitation._id} className="invitation-card">
                                <div className="invitation-info">
                                    <h4>{invitation.roomId.name}</h4>
                                    <p className="invitation-from">
                                        From: {invitation.invitedBy.username}
                                    </p>
                                    {invitation.message && (
                                        <p className="invitation-message">"{invitation.message}"</p>
                                    )}
                                    <p className="invitation-expires">
                                        Expires: {formatDate(invitation.expiresAt)}
                                    </p>
                                </div>
                                <div className="invitation-actions">
                                    <button 
                                        className="btn-accept"
                                        onClick={() => acceptInvitation(invitation.inviteCode)}
                                    >
                                        Accept
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'sent' && (
                <div className="invitations-list">
                    {sentInvitations.length === 0 ? (
                        <div className="no-invitations">No sent invitations</div>
                    ) : (
                        sentInvitations.map(invitation => (
                            <div key={invitation._id} className="invitation-card">
                                <div className="invitation-info">
                                    <h4>{invitation.roomId.name}</h4>
                                    <p className="invitation-type">
                                        Type: {invitation.type}
                                        {invitation.invitedUser && ` → ${invitation.invitedUser.username}`}
                                        {invitation.invitedEmail && ` → ${invitation.invitedEmail}`}
                                    </p>
                                    {invitation.message && (
                                        <p className="invitation-message">"{invitation.message}"</p>
                                    )}
                                    <p className="invitation-usage">
                                        Used: {invitation.usedCount}/{invitation.usageLimit}
                                    </p>
                                    <p className="invitation-expires">
                                        Expires: {formatDate(invitation.expiresAt)}
                                    </p>
                                </div>
                                <div className="invitation-actions">
                                    {getStatusBadge(invitation)}
                                    {invitation.status === 'pending' && (
                                        <button 
                                            className="btn-revoke"
                                            onClick={() => revokeInvitation(invitation._id)}
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default InvitationsList;
