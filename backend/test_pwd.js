const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    userId: String,
    password: { type: String, minlength: 6 },
    role: String
});

userSchema.pre('save', async function (next) {
    console.log('pre-save hook triggered, password modified:', this.isModified('password'));
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('password hashed');
    next();
});

const User = mongoose.model('TestUser', userSchema);

async function run() {
    await mongoose.connect('mongodb://localhost:27017/testdb');
    await User.deleteMany({});

    console.log('Creating user...');
    const user = new User({ userId: '123', password: 'oldPassword', role: 'student' });
    await user.save();

    console.log('Initial password hash:', user.password);

    console.log('Resetting password...');
    const fetchedUser = await User.findOne({ userId: '123' });
    fetchedUser.password = 'newPassword';
    await fetchedUser.save();

    console.log('New password hash:', fetchedUser.password);

    // Check if new password is saved in DB
    const finalUser = await User.findOne({ userId: '123' });
    console.log('Password in DB matches new hash?:', finalUser.password === fetchedUser.password);

    // Check if old password is still there
    const isOldMatch = await bcrypt.compare('oldPassword', finalUser.password);
    console.log('Can old password login?:', isOldMatch);

    const isNewMatch = await bcrypt.compare('newPassword', finalUser.password);
    console.log('Can new password login?:', isNewMatch);

    await mongoose.disconnect();
}

run().catch(console.error);
