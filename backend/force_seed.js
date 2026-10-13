const mongoose = require('mongoose');
require('dotenv').config();
const Book = require('./models/Book');

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bookbank');
        console.log('Connected to MongoDB. Forcing seed data...');

        const departments = ['CSE', 'ECE', 'EEE', 'Mechanical'];
        const seedBooks = [];

        for (const dept of departments) {
            for (let i = 1; i <= 20; i++) {
                seedBooks.push({
                    title: `${dept} Core Subject Book ${i}`,
                    author: `${dept} Expert Author ${i}`,
                    department: dept,
                    isbn: `ISBN-${dept}-${i.toString().padStart(3, '0')}`,
                    quantity: 5,
                    available: 5
                });
            }
        }

        await Book.insertMany(seedBooks);
        console.log(`✅ Successfully force-seeded ${seedBooks.length} books across departments.`);

        mongoose.disconnect();
    } catch (error) {
        console.error('Error seeding database:', error.message);
        mongoose.disconnect();
    }
};

seedDatabase();
