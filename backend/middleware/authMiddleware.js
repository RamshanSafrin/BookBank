// ============================================================
//  Authentication Middleware
//  - protect:    verifies JWT, attaches req.user
//  - roleGuard:  restricts routes by role
// ============================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verify JWT token
 */
const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized — no token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check for hardcoded admin
        if (decoded.id === 'admin') {
            req.user = { _id: 'admin', role: 'librarian', name: 'Admin Librarian' };
            return next();
        }

        // Attach user to request
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            console.warn(`Auth failed: User not found for ID ${decoded.id}`);
            return res.status(401).json({ message: 'Not authorized — user not found' });
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(401).json({ message: 'Not authorized — token invalid' });
    }
};

const roleGuard = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            console.warn('RoleGuard failed: req.user is missing');
            return res.status(403).json({ message: 'Access denied — user not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            console.warn(`RoleGuard denied: User ${req.user.userId || req.user._id} with role ${req.user.role} tried to access a ${roles.join('/')} route`);
            return res.status(403).json({ message: 'Access denied — insufficient permissions' });
        }
        next();
    };
};

module.exports = { protect, roleGuard };
