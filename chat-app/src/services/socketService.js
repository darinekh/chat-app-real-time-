import { io } from 'socket.io-client';
import authService from './authService';

class SocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
    }

    // Connect to socket with authentication
    connect() {
        const token = authService.getToken();
        
        if (!token) {
            throw new Error('No authentication token found');
        }

        this.socket = io(window.location.origin, {
            auth: {
                token: token
            },
            autoConnect: true
        });

        this.setupEventListeners();
        return this.socket;
    }

    // Setup basic event listeners
    setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            
            if (error.message.includes('Authentication error')) {
                // Token is invalid, redirect to login
                authService.clearAuthData();
                window.location.href = '/login';
            }
        });
    }

    // Join a chat room
    joinRoom(room) {
        if (this.socket) {
            this.socket.emit('join', { room });
        }
    }

    // Send a message
    sendMessage(message) {
        if (this.socket) {
            this.socket.emit('sendMessage', { message });
        }
    }

    // Send typing indicator
    sendTyping(isTyping) {
        if (this.socket) {
            this.socket.emit('typing', { isTyping });
        }
    }

    // Listen for messages
    onMessage(callback) {
        if (this.socket) {
            this.socket.on('newMessage', callback);
        }
    }

    // Listen for previous messages
    onPreviousMessages(callback) {
        if (this.socket) {
            this.socket.on('previousMessages', callback);
        }
    }

    // Listen for user joined
    onUserJoined(callback) {
        if (this.socket) {
            this.socket.on('userJoined', callback);
        }
    }

    // Listen for user left
    onUserLeft(callback) {
        if (this.socket) {
            this.socket.on('userLeft', callback);
        }
    }

    // Listen for user list updates
    onUserList(callback) {
        if (this.socket) {
            this.socket.on('userList', callback);
        }
    }

    // Listen for typing indicators
    onUserTyping(callback) {
        if (this.socket) {
            this.socket.on('userTyping', callback);
        }
    }

    // Listen for errors
    onError(callback) {
        if (this.socket) {
            this.socket.on('error', callback);
        }
    }

    // Remove event listeners
    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    // Disconnect socket
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    // Get connection status
    getConnectionStatus() {
        return this.isConnected;
    }

    // Get socket instance
    getSocket() {
        return this.socket;
    }
}

export default new SocketService();
