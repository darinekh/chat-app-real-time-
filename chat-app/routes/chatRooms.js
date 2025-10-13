const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const router = express.Router();

// Rate limiting for chat room operations
const roomLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: {
        error: 'Too many room operations, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Models will be initialized from server.js
let ChatRoom;
let User;

// Initialize models
const initializeChatRoomRoutes = (chatRoomModel, userModel) => {
    ChatRoom = chatRoomModel;
    User = userModel;
};

// Validation helpers
const validateRoomName = (name) => {
    if (!name || typeof name !== 'string') {
        return 'Room name is required';
    }
    if (name.length < 3 || name.length > 30) {
        return 'Room name must be between 3 and 30 characters';
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return 'Room name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return null;
};

const validateRoomDescription = (description) => {
    if (description && description.length > 200) {
        return 'Room description must be less than 200 characters';
    }
    return null;
};

// GET /api/rooms - Get all chat rooms
router.get('/', async (req, res) => {
    try {
        const rooms = await ChatRoom.find({ isActive: true })
            .populate('createdBy', 'username')
            .populate('members', 'username isOnline')
            .sort({ createdAt: -1 })
            .exec();

        const roomsWithStats = rooms.map(room => ({
            _id: room._id,
            name: room.name,
            description: room.description,
            isPrivate: room.isPrivate,
            memberCount: room.members.length,
            onlineCount: room.members.filter(member => member.isOnline).length,
            createdBy: room.createdBy,
            createdAt: room.createdAt,
            lastActivity: room.lastActivity
        }));

        res.json({
            success: true,
            rooms: roomsWithStats
        });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({
            error: 'Failed to fetch chat rooms'
        });
    }
});

// POST /api/rooms - Create a new chat room
router.post('/', roomLimiter, async (req, res) => {
    try {
        const { name, description, isPrivate = false } = req.body;
        const userId = req.user.id;

        // Validate input
        const nameError = validateRoomName(name);
        if (nameError) {
            return res.status(400).json({ error: nameError });
        }

        const descError = validateRoomDescription(description);
        if (descError) {
            return res.status(400).json({ error: descError });
        }

        // Check if room name already exists
        const existingRoom = await ChatRoom.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            isActive: true 
        });

        if (existingRoom) {
            return res.status(409).json({
                error: 'A room with this name already exists'
            });
        }

        // Create new room
        const newRoom = new ChatRoom({
            name: name.trim(),
            description: description ? description.trim() : '',
            isPrivate,
            createdBy: userId,
            members: [userId],
            lastActivity: new Date()
        });

        await newRoom.save();

        // Populate the response
        await newRoom.populate('createdBy', 'username');
        await newRoom.populate('members', 'username isOnline');

        res.status(201).json({
            success: true,
            message: 'Chat room created successfully',
            room: {
                _id: newRoom._id,
                name: newRoom.name,
                description: newRoom.description,
                isPrivate: newRoom.isPrivate,
                memberCount: newRoom.members.length,
                onlineCount: newRoom.members.filter(member => member.isOnline).length,
                createdBy: newRoom.createdBy,
                createdAt: newRoom.createdAt,
                lastActivity: newRoom.lastActivity
            }
        });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({
            error: 'Failed to create chat room'
        });
    }
});

// POST /api/rooms/:roomId/join - Join a chat room
router.post('/:roomId/join', roomLimiter, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;

        // Validate roomId
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        // Find the room
        const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        // Check if user is already a member
        if (room.members.includes(userId)) {
            return res.status(409).json({ error: 'You are already a member of this room' });
        }

        // Add user to room
        room.members.push(userId);
        room.lastActivity = new Date();
        await room.save();

        // Update user's current room
        await User.findByIdAndUpdate(userId, { room: room.name });

        await room.populate('members', 'username isOnline');

        res.json({
            success: true,
            message: 'Successfully joined the room',
            room: {
                _id: room._id,
                name: room.name,
                description: room.description,
                memberCount: room.members.length,
                onlineCount: room.members.filter(member => member.isOnline).length
            }
        });
    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({
            error: 'Failed to join chat room'
        });
    }
});

// POST /api/rooms/:roomId/leave - Leave a chat room
router.post('/:roomId/leave', roomLimiter, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;

        // Validate roomId
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        // Find the room
        const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        // Check if user is a member
        if (!room.members.includes(userId)) {
            return res.status(409).json({ error: 'You are not a member of this room' });
        }

        // Remove user from room
        room.members = room.members.filter(memberId => !memberId.equals(userId));
        room.lastActivity = new Date();

        // If room is empty and not the default room, deactivate it
        if (room.members.length === 0 && room.name !== 'general') {
            room.isActive = false;
        }

        await room.save();

        // Update user's current room to general
        await User.findByIdAndUpdate(userId, { room: 'general' });

        res.json({
            success: true,
            message: 'Successfully left the room'
        });
    } catch (error) {
        console.error('Error leaving room:', error);
        res.status(500).json({
            error: 'Failed to leave chat room'
        });
    }
});

// GET /api/rooms/:roomId - Get specific room details
router.get('/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;

        // Validate roomId
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        const room = await ChatRoom.findOne({ _id: roomId, isActive: true })
            .populate('createdBy', 'username')
            .populate('members', 'username isOnline lastSeen')
            .exec();

        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        res.json({
            success: true,
            room: {
                _id: room._id,
                name: room.name,
                description: room.description,
                isPrivate: room.isPrivate,
                createdBy: room.createdBy,
                members: room.members,
                memberCount: room.members.length,
                onlineCount: room.members.filter(member => member.isOnline).length,
                createdAt: room.createdAt,
                lastActivity: room.lastActivity
            }
        });
    } catch (error) {
        console.error('Error fetching room details:', error);
        res.status(500).json({
            error: 'Failed to fetch room details'
        });
    }
});

// GET /api/rooms/:roomId/members - Get room members
router.get('/:roomId/members', async (req, res) => {
    try {
        const { roomId } = req.params;

        // Validate roomId
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        const room = await ChatRoom.findOne({ _id: roomId, isActive: true })
            .populate('members', 'username isOnline lastSeen joinedAt')
            .exec();

        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        res.json({
            success: true,
            members: room.members,
            memberCount: room.members.length,
            onlineCount: room.members.filter(member => member.isOnline).length
        });
    } catch (error) {
        console.error('Error fetching room members:', error);
        res.status(500).json({
            error: 'Failed to fetch room members'
        });
    }
});

module.exports = { router, initializeChatRoomRoutes };
