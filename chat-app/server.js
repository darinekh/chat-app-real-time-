require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

// Import authentication modules
const { router: authRouter, initializeAuth } = require('./routes/auth');
const { authenticateSocket, initializeAuthMiddleware } = require('./middleware/auth');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        },
    },
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.CLIENT_URL, 'https://*.vercel.app']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve React build
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

// MongoDB connection with retry logic
const connectToMongoDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Successfully connected to MongoDB');
        console.log('📊 Database:', mongoose.connection.name);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);

        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n🔧 MongoDB Connection Help:');
            console.log('1. Make sure MongoDB is installed and running locally');
            console.log('2. Or update MONGODB_URI in .env file to use MongoDB Atlas');
            console.log('3. For local MongoDB, run: mongod');
            console.log('4. For MongoDB Atlas, get your connection string from: https://cloud.mongodb.com\n');
        }

        // Retry connection after 5 seconds
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectToMongoDB, 5000);
    }
};

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
    console.error('🚨 Mongoose connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('🛑 MongoDB connection closed through app termination');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
});

// Start MongoDB connection
connectToMongoDB();

// Message Schema
const messageSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    room: {
        type: String,
        default: 'general'
    }
});

const Message = mongoose.model('Message', messageSchema);

// User Schema for Authentication
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    socketId: {
        type: String,
        default: null
    },
    room: {
        type: String,
        default: 'general'
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

// Initialize authentication modules with User model
initializeAuth(User);
initializeAuthMiddleware(User);

// Authentication routes
app.use('/api/auth', authRouter);

// Routes - serve React app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// API Routes
app.get('/api/messages/:room', async (req, res) => {
    try {
        const { room } = req.params;
        const messages = await Message.find({ room })
            .sort({ timestamp: -1 })
            .limit(50)
            .exec();
        res.json(messages.reverse());
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.get('/api/users/:room', async (req, res) => {
    try {
        const { room } = req.params;
        const users = await User.find({ room }).select('username joinedAt').exec();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Socket.IO authentication middleware
io.use(authenticateSocket);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New authenticated client connected:', socket.id, 'User:', socket.user.username);

    // Handle user joining a room
    socket.on('join', async (data) => {
        try {
            const { room = 'general' } = data;
            const user = socket.user; // User is already authenticated

            // Update user's room and socket info
            await User.findByIdAndUpdate(user._id, {
                socketId: socket.id,
                room,
                isOnline: true,
                lastSeen: new Date()
            });

            // Join the room
            socket.join(room);
            socket.room = room;

            // Notify room about new user
            socket.to(room).emit('userJoined', {
                username: user.username,
                message: `${user.username} joined the chat`,
                timestamp: new Date()
            });

            // Send recent messages to the new user
            const recentMessages = await Message.find({ room })
                .sort({ timestamp: -1 })
                .limit(20)
                .exec();
            
            socket.emit('previousMessages', recentMessages.reverse());

            // Send updated user list to room
            const users = await User.find({ room }).select('username joinedAt').exec();
            io.to(room).emit('userList', users);

        } catch (error) {
            console.error('Error handling join:', error);
            socket.emit('error', { message: 'Failed to join chat' });
        }
    });

    // Handle new messages
    socket.on('sendMessage', async (data) => {
        try {
            const { message } = data;
            const user = socket.user;
            const room = socket.room || 'general';

            if (!message || !message.trim()) {
                return socket.emit('error', { message: 'Message content is required' });
            }

            // Save message to database
            const newMessage = new Message({
                username: user.username,
                message: message.trim(),
                room,
                timestamp: new Date()
            });
            await newMessage.save();

            // Broadcast message to room
            io.to(room).emit('newMessage', {
                username: user.username,
                message: message.trim(),
                timestamp: newMessage.timestamp,
                room
            });

        } catch (error) {
            console.error('Error handling message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        socket.to(socket.room || 'general').emit('userTyping', {
            username: socket.user.username,
            isTyping: data.isTyping
        });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        try {
            console.log('Client disconnected:', socket.id, 'User:', socket.user.username);

            if (socket.user && socket.room) {
                // Update user status in database
                await User.findByIdAndUpdate(socket.user._id, {
                    isOnline: false,
                    lastSeen: new Date(),
                    socketId: null
                });

                // Notify room about user leaving
                socket.to(socket.room).emit('userLeft', {
                    username: socket.user.username,
                    message: `${socket.user.username} left the chat`,
                    timestamp: new Date()
                });

                // Send updated user list to room
                const users = await User.find({ room: socket.room }).select('username joinedAt').exec();
                socket.to(socket.room).emit('userList', users);
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server (only if not in Vercel environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Visit http://localhost:${PORT} to access the chat application`);
    });
}

module.exports = app; // Export app for Vercel
module.exports.server = server;
module.exports.io = io;
