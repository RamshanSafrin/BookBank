// ============================================================
//  User Model — Mongoose Schema
//  Roles: student | librarian
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            default: '',
        },
        userId: {
            type: String,
            required: [true, 'User ID is required'],
            unique: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
        },
        role: {
            type: String,
            enum: ['student', 'librarian'],
            default: 'student',
        },
        department: {
            type: String,
            trim: true,
            default: '',
        },
        fineBalance: {
            type: Number,
            default: 0,
        },
        notifications: [
            {
                message: { type: String, required: true },
                date: { type: Date, default: Date.now },
                read: { type: Boolean, default: false },
            }
        ],
        borrowedBooks: [
            {
                book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
                issueDate: { type: Date, default: Date.now },
                dueDate: {
                    type: Date,
                    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
                },
                returnDate: { type: Date },
                fine: { type: Number, default: 0 },
                finePaid: { type: Boolean, default: false },
                status: { type: String, enum: ['issued', 'returned'], default: 'issued' },
            },
        ],
    },
    { timestamps: true }
);

// ── Hash password before saving ─────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ── Compare entered password with hashed password ───────────
userSchema.methods.comparePassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
