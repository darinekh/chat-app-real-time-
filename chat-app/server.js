require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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

// User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    socketId: {
        type: String,
        required: true
    },
    room: {
        type: String,
        default: 'general'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle user joining
    socket.on('join', async (data) => {
        try {
            const { username, room = 'general' } = data;
            
            // Remove existing user with same username
            await User.deleteMany({ username });
            
            // Create new user
            const user = new User({
                username,
                socketId: socket.id,
                room
            });
            await user.save();

            // Join the room
            socket.join(room);
            socket.username = username;
            socket.room = room;

            // Notify room about new user
            socket.to(room).emit('userJoined', {
                username,
                message: `${username} joined the chat`,
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
            const username = socket.username;
            const room = socket.room || 'general';

            if (!username || !message) {
                return socket.emit('error', { message: 'Username and message are required' });
            }

            // Save message to database
            const newMessage = new Message({
                username,
                message,
                room,
                timestamp: new Date()
            });
            await newMessage.save();

            // Broadcast message to room
            io.to(room).emit('newMessage', {
                username,
                message,
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
            username: socket.username,
            isTyping: data.isTyping
        });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        try {
            console.log('Client disconnected:', socket.id);
            
            if (socket.username && socket.room) {
                // Remove user from database
                await User.deleteOne({ socketId: socket.id });

                // Notify room about user leaving
                socket.to(socket.room).emit('userLeft', {
                    username: socket.username,
                    message: `${socket.username} left the chat`,
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the chat application`);
});

module.exports = { app, server, io };
