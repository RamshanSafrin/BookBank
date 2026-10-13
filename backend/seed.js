const Book = require('./models/Book');

const seedDatabase = async () => {
    try {
        const bookCount = await Book.countDocuments();
        if (bookCount === 0) {
            console.log('Database empty. Seeding initial books...');

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
            console.log(`✅ Successfully seeded ${seedBooks.length} books across departments.`);
        }
    } catch (error) {
        console.error('Error seeding database:', error.message);
    }
};

module.exports = seedDatabase;
