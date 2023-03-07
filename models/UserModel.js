const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    firstName: String,
    lastName: String,
    email: String,
    password: String,
    verified: Boolean,
    favourites: Array,
    recents: Array,
    img:
        {
            data: Buffer,
            contentType: String
        }
});

const User = new mongoose.model('User', userSchema);

module.exports = User;