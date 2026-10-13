// ============================================================
//  Reset Script — Deletes ALL student accounts + reservations
//  Run once: node reset_students.js
// ============================================================

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbank';

async function resetStudents() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const User = require('./models/User');
        const Reservation = require('./models/Reservation');
        const Book = require('./models/Book');

        // Delete all student users
        const deletedStudents = await User.deleteMany({ role: 'student' });
        console.log(`🗑️  Deleted ${deletedStudents.deletedCount} student account(s)`);

        // Delete all reservations
        const deletedReservations = await Reservation.deleteMany({});
        console.log(`🗑️  Deleted ${deletedReservations.deletedCount} reservation(s)`);

        // Reset all books: clear issuedTo, restore available = quantity
        const books = await Book.find({});
        for (const book of books) {
            book.issuedTo = [];
            book.available = book.quantity;
            await book.save();
        }
        console.log(`📚 Reset ${books.length} book(s) — availability restored`);

        console.log('\n✅ Done! All student data cleared. You can now register fresh students.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

resetStudents();
