require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Import authentication modules
const { router: authRouter, initializeAuth } = require('./routes/auth');
const { initializeAuthMiddleware, authenticateToken, authenticateSocket } = require('./middleware/auth');
const { router: chatRoomRouter, initializeChatRoomRoutes } = require('./routes/chatRooms');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve React build
app.use(express.static(path.join(__dirname, 'dist')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp';

console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    socketId: { type: String, default: null },
    room: { type: String, default: 'general' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ChatRoom Schema
const chatRoomSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    description: { type: String, maxlength: 200, default: '' },
    isPrivate: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
    maxMembers: { type: Number, default: 100 }
}, { timestamps: true });

// Indexes for better performance
chatRoomSchema.index({ name: 1, isActive: 1 });
chatRoomSchema.index({ createdBy: 1 });
chatRoomSchema.index({ members: 1 });
chatRoomSchema.index({ lastActivity: -1 });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    message: { type: String, required: true, maxlength: 1000 },
    room: { type: String, required: true, default: 'general' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for better performance
messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ userId: 1 });

const Message = mongoose.model('Message', messageSchema);

// Initialize auth with User model
initializeAuth(User);
initializeAuthMiddleware(User);
initializeChatRoomRoutes(ChatRoom, User);

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Successfully connected to MongoDB');
        console.log('📊 Database:', mongoose.connection.name);

        // Create default general room if it doesn't exist
        await createDefaultRoom();
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    });

// Create default general room
const createDefaultRoom = async () => {
    try {
        const existingRoom = await ChatRoom.findOne({ name: 'general' });
        if (!existingRoom) {
            // Create a system user for the general room if needed
            let systemUser = await User.findOne({ username: 'system' });
            if (!systemUser) {
                systemUser = new User({
                    username: 'system',
                    email: 'system@chatapp.com',
                    password: 'system123', // This will be hashed
                    isOnline: false
                });
                await systemUser.save();
            }

            const generalRoom = new ChatRoom({
                name: 'general',
                description: 'Default chat room for all users',
                isPrivate: false,
                createdBy: systemUser._id,
                members: [],
                isActive: true
            });

            await generalRoom.save();
            console.log('🏠 Created default "general" chat room');
        }
    } catch (error) {
        console.error('Error creating default room:', error);
    }
};

// Routes
app.use('/api/auth', authRouter);
app.use('/api/rooms', authenticateToken, chatRoomRouter);

// Serve React app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO Authentication Middleware
io.use(authenticateSocket);

// Socket.IO Connection Handling
io.on('connection', async (socket) => {
    console.log(`🔌 User connected: ${socket.user.username} (${socket.id})`);

    // Update user's socket ID and online status
    await User.findByIdAndUpdate(socket.user.id, {
        socketId: socket.id,
        isOnline: true,
        lastSeen: new Date()
    });

    // Join user's current room
    const user = await User.findById(socket.user.id);
    const currentRoom = user.room || 'general';
    socket.join(currentRoom);

    // Add user to room members if not already there
    await ChatRoom.findOneAndUpdate(
        { name: currentRoom },
        { $addToSet: { members: socket.user.id }, lastActivity: new Date() }
    );

    // Notify room about user joining
    socket.to(currentRoom).emit('userJoined', {
        username: socket.user.username,
        message: `${socket.user.username} joined the room`,
        timestamp: new Date(),
        room: currentRoom
    });

    // Send room user list
    await sendRoomUserList(currentRoom);

    // Send previous messages for the room
    try {
        const messages = await Message.find({ room: currentRoom })
            .sort({ timestamp: -1 })
            .limit(50)
            .exec();
        socket.emit('previousMessages', messages.reverse());
    } catch (error) {
        console.error('Error fetching messages:', error);
    }

    // Handle joining a room
    socket.on('joinRoom', async (data) => {
        try {
            const { room: newRoom } = data;
            const oldRoom = user.room || 'general';

            if (newRoom === oldRoom) return;

            // Leave old room
            socket.leave(oldRoom);
            await ChatRoom.findOneAndUpdate(
                { name: oldRoom },
                { $pull: { members: socket.user.id }, lastActivity: new Date() }
            );

            // Join new room
            socket.join(newRoom);
            await User.findByIdAndUpdate(socket.user.id, { room: newRoom });
            await ChatRoom.findOneAndUpdate(
                { name: newRoom },
                { $addToSet: { members: socket.user.id }, lastActivity: new Date() }
            );

            // Notify old room about user leaving
            socket.to(oldRoom).emit('userLeft', {
                username: socket.user.username,
                message: `${socket.user.username} left the room`,
                timestamp: new Date(),
                room: oldRoom
            });

            // Notify new room about user joining
            socket.to(newRoom).emit('userJoined', {
                username: socket.user.username,
                message: `${socket.user.username} joined the room`,
                timestamp: new Date(),
                room: newRoom
            });

            // Update user lists for both rooms
            await sendRoomUserList(oldRoom);
            await sendRoomUserList(newRoom);

            // Send previous messages for new room
            const messages = await Message.find({ room: newRoom })
                .sort({ timestamp: -1 })
                .limit(50)
                .exec();
            socket.emit('previousMessages', messages.reverse());

        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
        try {
            const { message } = data;
            const userRoom = user.room || 'general';

            if (!message || message.trim().length === 0) {
                return socket.emit('error', { message: 'Message cannot be empty' });
            }

            if (message.length > 1000) {
                return socket.emit('error', { message: 'Message too long' });
            }

            // Save message to database
            const newMessage = new Message({
                username: socket.user.username,
                message: message.trim(),
                room: userRoom,
                userId: socket.user.id,
                timestamp: new Date()
            });

            await newMessage.save();

            // Update room's last activity
            await ChatRoom.findOneAndUpdate(
                { name: userRoom },
                { lastActivity: new Date() }
            );

            // Broadcast message to room
            io.to(userRoom).emit('newMessage', {
                _id: newMessage._id,
                username: newMessage.username,
                message: newMessage.message,
                room: newMessage.room,
                timestamp: newMessage.timestamp
            });

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        const userRoom = user.room || 'general';
        socket.to(userRoom).emit('userTyping', {
            username: socket.user.username,
            isTyping: data.isTyping
        });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        console.log(`🔌 User disconnected: ${socket.user.username} (${socket.id})`);

        try {
            // Update user's online status
            await User.findByIdAndUpdate(socket.user.id, {
                isOnline: false,
                lastSeen: new Date(),
                socketId: null
            });

            const userRoom = user.room || 'general';

            // Notify room about user leaving
            socket.to(userRoom).emit('userLeft', {
                username: socket.user.username,
                message: `${socket.user.username} left the room`,
                timestamp: new Date(),
                room: userRoom
            });

            // Update room user list
            await sendRoomUserList(userRoom);

        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });

    // Helper function to send room user list
    async function sendRoomUserList(roomName) {
        try {
            const room = await ChatRoom.findOne({ name: roomName })
                .populate('members', 'username isOnline lastSeen')
                .exec();

            if (room) {
                io.to(roomName).emit('roomUserList', {
                    room: roomName,
                    users: room.members,
                    onlineCount: room.members.filter(member => member.isOnline).length
                });
            }
        } catch (error) {
            console.error('Error sending user list:', error);
        }
    }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Visit http://localhost:${PORT} to access the chat application`);
});
