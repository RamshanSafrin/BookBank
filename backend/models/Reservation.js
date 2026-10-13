// ============================================================
//  Reservation Model — Mongoose Schema
// ============================================================

const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        book: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Book',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'completed'],
            default: 'pending',
        },
        reservationStartDate: {
            type: Date,
            required: true,
        },
        reservationEndDate: {
            type: Date,
            required: true,
        },
        reservedAt: {
            type: Date,
            default: Date.now,
        },
        issuedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
