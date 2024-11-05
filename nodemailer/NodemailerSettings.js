require('dotenv').config();
const nodemailer = require('nodemailer');

//nodemailer stuff
const transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com", // hostname
    secureConnection: false, // TLS requires secureConnection to be false
    port: 587,
    service: "outlook",
    auth: {
        user: process.env.USER,
        pass: process.env.PASS
    },
    tls:{
        ciphers: 'SSLv3'
    }
});


module.exports = transporter;
