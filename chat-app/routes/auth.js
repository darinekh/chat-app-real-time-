const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Get User model (will be passed from server.js)
let User;

// Initialize User model
const initializeAuth = (userModel) => {
    User = userModel;
};

// Validation helpers
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    return password && password.length >= 6;
};

const validateUsername = (username) => {
    return username && username.length >= 3 && username.length <= 20;
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Register route
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                error: 'Username, email, and password are required'
            });
        }

        if (!validateUsername(username)) {
            return res.status(400).json({
                error: 'Username must be between 3 and 20 characters'
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                error: 'Please provide a valid email address'
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({
                    error: 'Email already registered'
                });
            }
            if (existingUser.username === username) {
                return res.status(400).json({
                    error: 'Username already taken'
                });
            }
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        await newUser.save();

        // Generate token
        const token = generateToken(newUser._id);

        // Return success response (don't include password)
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                joinedAt: newUser.joinedAt
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 11000) {
            // Duplicate key error
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            });
        }

        res.status(500).json({
            error: 'Internal server error during registration'
        });
    }
});

// Login route
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Update user status
        await User.findByIdAndUpdate(user._id, {
            isOnline: true,
            lastSeen: new Date()
        });

        // Generate token
        const token = generateToken(user._id);

        // Return success response
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                joinedAt: user.joinedAt
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error during login'
        });
    }
});

// Logout route
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                await User.findByIdAndUpdate(decoded.userId, {
                    isOnline: false,
                    lastSeen: new Date(),
                    socketId: null
                });
            } catch (jwtError) {
                // Token invalid, but still return success for logout
                console.log('Invalid token during logout:', jwtError.message);
            }
        }

        res.json({
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal server error during logout'
        });
    }
});

// Get current user profile
router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen,
                joinedAt: user.joinedAt
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired'
            });
        }

        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Verify token route
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                error: 'No token provided',
                valid: false
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                valid: false
            });
        }

        res.json({
            valid: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        res.status(401).json({
            error: 'Invalid or expired token',
            valid: false
        });
    }
});

module.exports = { router, initializeAuth, generateToken };
