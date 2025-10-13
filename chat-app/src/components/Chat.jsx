import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import socketService from '../services/socketService';
import ChatRoomList from './ChatRoomList';
import './Chat.css';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [currentRoom, setCurrentRoom] = useState('general');
    const [messageInput, setMessageInput] = useState('');
    const [typingUsers, setTypingUsers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [user, setUser] = useState(null);
    const [showRoomList, setShowRoomList] = useState(false);
    
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Check authentication
        if (!authService.isAuthenticated()) {
            navigate('/login');
            return;
        }

        const currentUser = authService.getUser();
        setUser(currentUser);

        // Connect to socket
        try {
            const socket = socketService.connect();
            setIsConnected(true);

            // Join default room
            socketService.joinRoom(currentRoom);

            // Set up event listeners
            socketService.onMessage((message) => {
                setMessages(prev => [...prev, message]);
            });

            socketService.onPreviousMessages((messages) => {
                setMessages(messages);
            });

            socketService.onUserJoined((data) => {
                setMessages(prev => [...prev, {
                    username: 'System',
                    message: data.message,
                    timestamp: data.timestamp,
                    isSystem: true
                }]);
            });

            socketService.onUserLeft((data) => {
                setMessages(prev => [...prev, {
                    username: 'System',
                    message: data.message,
                    timestamp: data.timestamp,
                    isSystem: true
                }]);
            });

            // Listen for room user list updates
            socket.on('roomUserList', (data) => {
                if (data.room === currentRoom) {
                    setUsers(data.users || []);
                }
            });

            socketService.onUserTyping((data) => {
                if (data.isTyping) {
                    setTypingUsers(prev => {
                        if (!prev.includes(data.username)) {
                            return [...prev, data.username];
                        }
                        return prev;
                    });
                } else {
                    setTypingUsers(prev => prev.filter(u => u !== data.username));
                }
            });

            socketService.onError((error) => {
                console.error('Socket error:', error);
            });

        } catch (error) {
            console.error('Connection error:', error);
            navigate('/login');
        }

        // Cleanup on unmount
        return () => {
            socketService.disconnect();
        };
    }, [navigate, currentRoom]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!messageInput.trim()) return;

        socketService.sendMessage(messageInput.trim());
        setMessageInput('');
        
        // Stop typing indicator
        socketService.sendTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleInputChange = (e) => {
        setMessageInput(e.target.value);
        
        // Send typing indicator
        socketService.sendTyping(true);
        
        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        // Stop typing after 1 second of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            socketService.sendTyping(false);
        }, 1000);
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            socketService.disconnect();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleRoomChange = (roomName) => {
        if (roomName !== currentRoom) {
            setCurrentRoom(roomName);
            setMessages([]); // Clear messages when switching rooms
            setTypingUsers([]); // Clear typing indicators
            socketService.joinRoom(roomName);
        }
    };

    const handleRoomJoined = (roomName) => {
        setCurrentRoom(roomName);
        setMessages([]); // Clear messages when joining new room
        setTypingUsers([]); // Clear typing indicators
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    if (!user) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="chat-container">
            {/* Header */}
            <div className="chat-header">
                <div className="header-left">
                    <button
                        className="room-toggle-btn"
                        onClick={() => setShowRoomList(!showRoomList)}
                        title="Toggle room list"
                    >
                        <i className={`fas ${showRoomList ? 'fa-times' : 'fa-bars'}`}></i>
                    </button>
                    <h3>
                        <i className="fas fa-hashtag"></i>
                        {currentRoom}
                    </h3>
                    <span className="user-count">
                        {users.length} user{users.length !== 1 ? 's' : ''} online
                    </span>
                </div>
                <div className="header-right">
                    <span className="current-user">
                        <i className="fas fa-user"></i>
                        {user.username}
                    </span>
                    <button onClick={handleLogout} className="logout-btn">
                        <i className="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                </div>
            </div>

            <div className="chat-main">
                {/* Sidebar */}
                <div className={`sidebar ${showRoomList ? 'show-rooms' : 'show-users'}`}>
                    {showRoomList ? (
                        <ChatRoomList
                            currentRoom={currentRoom}
                            onRoomChange={handleRoomChange}
                            onRoomJoined={handleRoomJoined}
                        />
                    ) : (
                        <div className="sidebar-section">
                            <h4>
                                <i className="fas fa-users"></i>
                                Online Users
                            </h4>
                            <div className="user-list">
                                {users.map((user, index) => (
                                    <div key={index} className="user-item">
                                        <i className="fas fa-circle online-indicator"></i>
                                        {user.username || user}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Area */}
                <div className="chat-area">
                    <div className="messages">
                        {messages.map((message, index) => (
                            <div 
                                key={index} 
                                className={`message ${message.isSystem ? 'system-message' : ''}`}
                            >
                                {!message.isSystem && (
                                    <div className="message-header">
                                        <span className="message-username">
                                            {message.username}
                                        </span>
                                        <span className="message-time">
                                            {formatTime(message.timestamp)}
                                        </span>
                                    </div>
                                )}
                                <div className="message-content">
                                    {message.message}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Typing Indicator */}
                    {typingUsers.length > 0 && (
                        <div className="typing-indicator">
                            <i className="fas fa-ellipsis-h"></i>
                            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                        </div>
                    )}

                    {/* Message Input */}
                    <div className="message-input-container">
                        <form onSubmit={handleSendMessage} className="message-input">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={handleInputChange}
                                placeholder="Type your message..."
                                disabled={!isConnected}
                            />
                            <button type="submit" disabled={!isConnected || !messageInput.trim()}>
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;
