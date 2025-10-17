const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const crypto = require('crypto');

const router = express.Router();

// Rate limiting for invitation operations
const inviteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 invitations per windowMs
    message: {
        error: 'Too many invitations sent, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Models will be initialized from server.js
let ChatRoom;
let User;
let Invitation;

// Initialize models
const initializeInvitationRoutes = (chatRoomModel, userModel, invitationModel) => {
    ChatRoom = chatRoomModel;
    User = userModel;
    Invitation = invitationModel;
};

// Helper function to generate invite code
const generateInviteCode = () => {
    return crypto.randomBytes(16).toString('hex');
};

// POST /api/invitations/create - Create invitation for a room
router.post('/create', inviteLimiter, async (req, res) => {
    try {
        const { roomId, type = 'code', invitedUsername, invitedEmail, message = '', expiresInHours = 24, usageLimit = 1 } = req.body;
        const userId = req.user.id;

        // Validate roomId
        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        // Find the room
        const room = await ChatRoom.findOne({ _id: roomId, isActive: true });
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Check if user is a member of the room
        if (!room.members.includes(userId)) {
            return res.status(403).json({ error: 'You must be a member of the room to invite others' });
        }

        // Validate expiration
        if (expiresInHours < 1 || expiresInHours > 168) { // 1 hour to 1 week
            return res.status(400).json({ error: 'Expiration must be between 1 hour and 1 week' });
        }

        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        let invitedUser = null;

        // Handle direct user invitation
        if (type === 'direct' && invitedUsername) {
            invitedUser = await User.findOne({ username: invitedUsername });
            if (!invitedUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check if user is already a member
            if (room.members.includes(invitedUser._id)) {
                return res.status(409).json({ error: 'User is already a member of this room' });
            }

            // Check for existing pending invitation
            const existingInvite = await Invitation.findOne({
                roomId,
                invitedUser: invitedUser._id,
                status: 'pending',
                expiresAt: { $gt: new Date() }
            });

            if (existingInvite) {
                return res.status(409).json({ error: 'User already has a pending invitation to this room' });
            }
        }

        // Create invitation
        const invitation = new Invitation({
            roomId,
            invitedBy: userId,
            invitedUser: invitedUser ? invitedUser._id : null,
            invitedEmail: type === 'email' ? invitedEmail : null,
            inviteCode: generateInviteCode(),
            type,
            expiresAt,
            usageLimit: Math.max(1, Math.min(usageLimit, 100)), // limit between 1-100
            message: message.trim().substring(0, 200)
        });

        await invitation.save();

        // Populate the response
        await invitation.populate('invitedBy', 'username');
        await invitation.populate('invitedUser', 'username');
        await invitation.populate('roomId', 'name description');

        res.status(201).json({
            success: true,
            message: 'Invitation created successfully',
            invitation: {
                _id: invitation._id,
                inviteCode: invitation.inviteCode,
                type: invitation.type,
                room: invitation.roomId,
                invitedBy: invitation.invitedBy,
                invitedUser: invitation.invitedUser,
                invitedEmail: invitation.invitedEmail,
                message: invitation.message,
                expiresAt: invitation.expiresAt,
                usageLimit: invitation.usageLimit,
                usedCount: invitation.usedCount,
                inviteUrl: `${req.protocol}://${req.get('host')}/invite/${invitation.inviteCode}`
            }
        });
    } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({ error: 'Failed to create invitation' });
    }
});

// GET /api/invitations/received - Get invitations received by current user
router.get('/received', async (req, res) => {
    try {
        const userId = req.user.id;

        const invitations = await Invitation.find({
            $or: [
                { invitedUser: userId },
                { invitedEmail: req.user.email }
            ],
            status: 'pending',
            expiresAt: { $gt: new Date() }
        })
        .populate('roomId', 'name description')
        .populate('invitedBy', 'username')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            invitations
        });
    } catch (error) {
        console.error('Error fetching received invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
    }
});

// GET /api/invitations/sent - Get invitations sent by current user
router.get('/sent', async (req, res) => {
    try {
        const userId = req.user.id;

        const invitations = await Invitation.find({
            invitedBy: userId
        })
        .populate('roomId', 'name description')
        .populate('invitedUser', 'username')
        .sort({ createdAt: -1 })
        .limit(50);

        res.json({
            success: true,
            invitations
        });
    } catch (error) {
        console.error('Error fetching sent invitations:', error);
        res.status(500).json({ error: 'Failed to fetch sent invitations' });
    }
});

// POST /api/invitations/:inviteCode/accept - Accept invitation by code
router.post('/:inviteCode/accept', async (req, res) => {
    try {
        const { inviteCode } = req.params;
        const userId = req.user.id;

        // Find the invitation
        const invitation = await Invitation.findOne({
            inviteCode,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }).populate('roomId');

        if (!invitation) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        // Check if it's a direct invitation for a specific user
        if (invitation.invitedUser && !invitation.invitedUser.equals(userId)) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }

        // Check usage limit
        if (invitation.usedCount >= invitation.usageLimit) {
            return res.status(410).json({ error: 'Invitation has reached its usage limit' });
        }

        const room = invitation.roomId;

        // Check if user is already a member
        if (room.members.includes(userId)) {
            return res.status(409).json({ error: 'You are already a member of this room' });
        }

        // Add user to room
        room.members.push(userId);
        room.lastActivity = new Date();
        await room.save();

        // Update invitation
        invitation.usedCount += 1;
        if (invitation.usedCount >= invitation.usageLimit) {
            invitation.status = 'accepted';
        }
        await invitation.save();

        // Update user's current room
        await User.findByIdAndUpdate(userId, { room: room.name });

        res.json({
            success: true,
            message: `Successfully joined ${room.name}`,
            room: {
                _id: room._id,
                name: room.name,
                description: room.description
            }
        });
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

// DELETE /api/invitations/:invitationId - Revoke/delete invitation
router.delete('/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const userId = req.user.id;

        // Validate invitationId
        if (!mongoose.Types.ObjectId.isValid(invitationId)) {
            return res.status(400).json({ error: 'Invalid invitation ID' });
        }

        // Find the invitation
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Check if user is the one who created the invitation
        if (!invitation.invitedBy.equals(userId)) {
            return res.status(403).json({ error: 'You can only revoke your own invitations' });
        }

        // Update invitation status
        invitation.status = 'expired';
        await invitation.save();

        res.json({
            success: true,
            message: 'Invitation revoked successfully'
        });
    } catch (error) {
        console.error('Error revoking invitation:', error);
        res.status(500).json({ error: 'Failed to revoke invitation' });
    }
});

// GET /api/invitations/code/:inviteCode - Get invitation details by code (for preview)
router.get('/code/:inviteCode', async (req, res) => {
    try {
        const { inviteCode } = req.params;

        const invitation = await Invitation.findOne({
            inviteCode,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        })
        .populate('roomId', 'name description isPrivate')
        .populate('invitedBy', 'username');

        if (!invitation) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        // Check usage limit
        if (invitation.usedCount >= invitation.usageLimit) {
            return res.status(410).json({ error: 'Invitation has reached its usage limit' });
        }

        res.json({
            success: true,
            invitation: {
                room: invitation.roomId,
                invitedBy: invitation.invitedBy,
                message: invitation.message,
                expiresAt: invitation.expiresAt,
                usageLimit: invitation.usageLimit,
                usedCount: invitation.usedCount
            }
        });
    } catch (error) {
        console.error('Error fetching invitation details:', error);
        res.status(500).json({ error: 'Failed to fetch invitation details' });
    }
});

module.exports = { router, initializeInvitationRoutes };
