// ============================================================
//  Authentication Routes
//  POST /api/auth/register — Create a new user
//  POST /api/auth/login    — Authenticate & return JWT
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Generate a signed JWT for a given user ID
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, userId, password, department } = req.body;

        // Validate required fields
        if (!name || !userId || !password) {
            return res.status(400).json({ message: 'Name, Register Number, and Password are required' });
        }

        // Check for existing user
        const existingUser = await User.findOne({ userId });
        if (existingUser) {
            return res.status(400).json({ message: 'Register Number already exists. Please use a unique Register Number.' });
        }

        // Create new user (force student role)
        const user = await User.create({
            name,
            email: email || '',
            userId,
            password,
            role: 'student',
            department: department || '',
        });

        // Return user data + token
        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                userId: user.userId,
                role: user.role,
                department: user.department,
            },
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Register error:', error.message);
        res.status(500).json({ message: 'Server error during registration', error: error.message });
    }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { name, userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({ message: 'Register Number and Password are required' });
        }

        // Check for hardcoded librarian
        if (userId === 'admin' && password === 'adminGCE123') {
            return res.json({
                message: 'Login successful',
                user: {
                    id: 'admin',
                    name: 'Admin Librarian',
                    userId: 'admin',
                    role: 'librarian',
                    department: 'Library',
                },
                token: generateToken('admin'),
            });
        }

        // Find user by userId (Register Number)
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials. Check your Register Number.' });
        }

        // If name provided, verify it matches (case-insensitive)
        if (name && name.trim() !== '') {
            const nameMatch = user.name.toLowerCase() === name.trim().toLowerCase();
            if (!nameMatch) {
                return res.status(401).json({ message: 'Name does not match our records.' });
            }
        }

        // Compare passwords
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials. Check your password.' });
        }

        // Return user data + token
        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                userId: user.userId,
                role: user.role,
                department: user.department,
            },
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }
});

// ── GET /api/auth/me — Get Current User Profile ─────────────
router.get('/me', protect, async (req, res) => {
    try {
        // Admin librarian doesn't have a DB record
        if (req.user._id === 'admin') {
            return res.json({
                _id: 'admin',
                name: 'Admin Librarian',
                userId: 'admin',
                role: 'librarian',
                department: 'Library',
                borrowedBooks: [],
                notifications: [],
                fineBalance: 0,
            });
        }
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('borrowedBooks.book');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching profile', error: error.message });
    }
});

// ── POST /api/auth/pay-fine — Pay accumulated fines ─────────
router.post('/pay-fine', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.fineBalance === 0) {
            return res.status(400).json({ message: 'No pending fines to pay.' });
        }

        const paidAmount = user.fineBalance;
        user.fineBalance = 0;

        // Mark all fined borrowedBooks as finePaid
        user.borrowedBooks.forEach(b => {
            if (b.fine > 0 && !b.finePaid) {
                b.finePaid = true;
            }
        });

        user.notifications.push({
            message: `Paid fine of ₹${paidAmount} successfully.`,
            date: new Date(),
        });

        await user.save();
        res.json({ message: `Successfully paid ₹${paidAmount}.`, user });
    } catch (error) {
        res.status(500).json({ message: 'Server error paying fine', error: error.message });
    }
});

// ── POST /api/auth/reset-password ───────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        if (!userId || !newPassword) {
            return res.status(400).json({ message: 'Register Number and New Password are required' });
        }

        const user = await User.findOne({ userId, role: 'student' });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error.message);
        res.status(500).json({ message: 'Server error during password reset', error: error.message });
    }
});

module.exports = router;
