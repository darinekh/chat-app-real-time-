const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// JWT Secret (should match the one in auth routes)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// User model will be set from server.js
let User;

// Initialize User model
const initializeAuthMiddleware = (userModel) => {
    User = userModel;
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                error: 'Access denied. No token provided.'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Find user
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({
                error: 'Access denied. User not found.'
            });
        }

        // Add user to request object
        req.user = user;
        next();

    } catch (error) {
        console.error('Authentication middleware error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Access denied. Invalid token.'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Access denied. Token expired.'
            });
        }

        return res.status(500).json({
            error: 'Internal server error during authentication.'
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        req.user = user || null;
        next();

    } catch (error) {
        // If token is invalid, just continue without user
        req.user = null;
        next();
    }
};

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        // Add user to socket object
        socket.user = user;
        next();

    } catch (error) {
        console.error('Socket authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return next(new Error('Authentication error: Invalid token'));
        }
        
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Authentication error: Token expired'));
        }

        return next(new Error('Authentication error: Server error'));
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Access denied. Authentication required.'
            });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
};

// Rate limiting middleware for authenticated routes
const createAuthRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
    const rateLimit = require('express-rate-limit');
    
    return rateLimit({
        windowMs,
        max,
        message: {
            error: 'Too many requests from this user, please try again later.'
        },
        keyGenerator: (req) => {
            return req.user ? req.user._id.toString() : req.ip;
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// Middleware to check if user owns resource
const checkOwnership = (resourceField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        // Check if user owns the resource
        const resourceUserId = req.params[resourceField] || req.body[resourceField];
        
        if (resourceUserId && resourceUserId !== req.user._id.toString()) {
            return res.status(403).json({
                error: 'Access denied. You can only access your own resources.'
            });
        }

        next();
    };
};

// Validation middleware for user data
const validateUserUpdate = (req, res, next) => {
    const { username, email } = req.body;
    
    if (username && (username.length < 3 || username.length > 20)) {
        return res.status(400).json({
            error: 'Username must be between 3 and 20 characters'
        });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            error: 'Please provide a valid email address'
        });
    }

    next();
};

module.exports = {
    authenticateToken,
    optionalAuth,
    authenticateSocket,
    authorize,
    createAuthRateLimit,
    checkOwnership,
    validateUserUpdate,
    initializeAuthMiddleware
};
