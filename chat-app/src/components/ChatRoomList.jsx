import React, { useState, useEffect } from 'react';
import CreateChatRoomForm from './CreateChatRoomForm';
import './ChatRoomList.css';

const ChatRoomList = ({ currentRoom, onRoomChange, onRoomJoined }) => {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [joiningRoom, setJoiningRoom] = useState(null);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/rooms', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                setRooms(data.rooms);
                setError('');
            } else {
                setError(data.error || 'Failed to fetch rooms');
            }
        } catch (error) {
            console.error('Error fetching rooms:', error);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async (roomId, roomName) => {
        if (joiningRoom === roomId) return;
        
        try {
            setJoiningRoom(roomId);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/rooms/${roomId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Update room member count locally
                setRooms(prevRooms => 
                    prevRooms.map(room => 
                        room._id === roomId 
                            ? { ...room, memberCount: room.memberCount + 1 }
                            : room
                    )
                );

                // Notify parent component
                if (onRoomJoined) {
                    onRoomJoined(roomName);
                }
                if (onRoomChange) {
                    onRoomChange(roomName);
                }
            } else {
                setError(data.error || 'Failed to join room');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            setError('Network error. Please try again.');
        } finally {
            setJoiningRoom(null);
        }
    };

    const handleLeaveRoom = async (roomId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/rooms/${roomId}/leave`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Update room member count locally
                setRooms(prevRooms => 
                    prevRooms.map(room => 
                        room._id === roomId 
                            ? { ...room, memberCount: Math.max(0, room.memberCount - 1) }
                            : room
                    )
                );

                // Switch to general room
                if (onRoomChange) {
                    onRoomChange('general');
                }
            } else {
                setError(data.error || 'Failed to leave room');
            }
        } catch (error) {
            console.error('Error leaving room:', error);
            setError('Network error. Please try again.');
        }
    };

    const handleRoomCreated = (newRoom) => {
        setRooms(prevRooms => [newRoom, ...prevRooms]);
        setShowCreateForm(false);
        
        // Automatically join the newly created room
        if (onRoomJoined) {
            onRoomJoined(newRoom.name);
        }
        if (onRoomChange) {
            onRoomChange(newRoom.name);
        }
    };

    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInMinutes = Math.floor((now - time) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    if (loading) {
        return (
            <div className="room-list-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Loading rooms...</span>
            </div>
        );
    }

    return (
        <div className="chat-room-list">
            <div className="room-list-header">
                <h4>
                    <i className="fas fa-door-open"></i>
                    Chat Rooms
                </h4>
                <button 
                    className="create-room-btn"
                    onClick={() => setShowCreateForm(true)}
                    title="Create new room"
                >
                    <i className="fas fa-plus"></i>
                </button>
            </div>

            {error && (
                <div className="room-list-error">
                    <i className="fas fa-exclamation-triangle"></i>
                    {error}
                    <button onClick={fetchRooms} className="retry-btn">
                        <i className="fas fa-redo"></i>
                    </button>
                </div>
            )}

            <div className="room-list">
                {rooms.length === 0 ? (
                    <div className="no-rooms">
                        <i className="fas fa-comments"></i>
                        <p>No chat rooms available</p>
                        <button 
                            className="btn btn-primary"
                            onClick={() => setShowCreateForm(true)}
                        >
                            Create First Room
                        </button>
                    </div>
                ) : (
                    rooms.map(room => (
                        <div
                            key={room._id}
                            className={`room-item ${currentRoom === room.name ? 'active' : ''}`}
                            onClick={() => {
                                if (currentRoom !== room.name) {
                                    handleJoinRoom(room._id, room.name);
                                }
                            }}
                            style={{ cursor: currentRoom === room.name ? 'default' : 'pointer' }}
                        >
                            <div className="room-info">
                                <div className="room-header">
                                    <h5 className="room-name">
                                        <i className={`fas ${room.isPrivate ? 'fa-lock' : 'fa-hashtag'}`}></i>
                                        {room.name}
                                    </h5>
                                    <div className="room-stats">
                                        <span className="member-count">
                                            <i className="fas fa-users"></i>
                                            {room.memberCount}
                                        </span>
                                        <span className="online-count">
                                            <i className="fas fa-circle online"></i>
                                            {room.onlineCount}
                                        </span>
                                    </div>
                                </div>
                                
                                {room.description && (
                                    <p className="room-description">{room.description}</p>
                                )}
                                
                                <div className="room-meta">
                                    <span className="created-by">
                                        by {room.createdBy?.username || 'Unknown'}
                                    </span>
                                    <span className="last-activity">
                                        {formatTimeAgo(room.lastActivity)}
                                    </span>
                                </div>
                            </div>

                            <div className="room-actions">
                                {currentRoom === room.name ? (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLeaveRoom(room._id);
                                        }}
                                        disabled={room.name === 'general'}
                                        title={room.name === 'general' ? 'Cannot leave general room' : 'Leave room'}
                                    >
                                        <i className="fas fa-sign-out-alt"></i>
                                        {room.name === 'general' ? 'Current' : 'Leave'}
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleJoinRoom(room._id, room.name);
                                        }}
                                        disabled={joiningRoom === room._id}
                                    >
                                        {joiningRoom === room._id ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i>
                                                Joining...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-sign-in-alt"></i>
                                                Join
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="room-list-footer">
                <button 
                    className="refresh-btn"
                    onClick={fetchRooms}
                    disabled={loading}
                    title="Refresh room list"
                >
                    <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                    Refresh
                </button>
            </div>

            {showCreateForm && (
                <CreateChatRoomForm
                    onRoomCreated={handleRoomCreated}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}
        </div>
    );
};

export default ChatRoomList;
