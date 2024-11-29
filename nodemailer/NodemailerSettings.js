require('dotenv').config();
const nodemailer = require('nodemailer');

//nodemailer stuff
const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
  port: 465, // Use 587 if you prefer TLS
  secure: true,
    auth: {
        user: process.env.ZOHOUSER,
        pass: process.env.ZOHOPASS
    }
});


module.exports = transporter;
