// ============================================================
//  Book Model — Mongoose Schema
// ============================================================

const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Book title is required'],
            trim: true,
        },
        author: {
            type: String,
            required: [true, 'Author name is required'],
            trim: true,
        },
        department: {
            type: String,
            required: [true, 'Department is required for seeding'],
            trim: true,
            enum: ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'],
            default: 'Other'
        },
        isbn: {
            type: String,
            required: [true, 'ISBN is required'],
            unique: true,
            trim: true,
        },
        quantity: {
            type: Number,
            required: true,
            default: 1,
            min: [0, 'Quantity cannot be negative'],
        },
        available: {
            type: Number,
            required: true,
            default: 1,
            min: [0, 'Available count cannot be negative'],
        },
        issuedTo: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                issueDate: { type: Date, default: Date.now },
                dueDate: {
                    type: Date,
                    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                },
            },
        ],
        addedDate: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
