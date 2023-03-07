require('dotenv').config();
const nodemailer = require('nodemailer');

//nodemailer stuff
const transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com",
    port: 587,
    service: "outlook",
    secure: false,
    auth: {
        user: process.env.USER,
        pass: process.env.PASS
    },
    tls:{
        ciphers: 'SSLv3'
    }
});

module.exports = transporter;