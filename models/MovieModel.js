const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const movieSchema = new Schema({
    name: String,
    category: String,
    type: String,
    rating: Number,
    snvl: String,
    trailer: String,
    download: String,
    description: String,
    img: String
});


const movie = new mongoose.model('Movie', movieSchema);

module.exports = movie;