require('dotenv').config();

const express = require('express');
const app = express();
const enforce = require('express-sslify');
app.use(enforce.HTTPS({trustProtoHeader: true}));
const bodyParser = require('body-parser');
const _ = require('lodash');
const cors = require('cors');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/UserModel');
const transporter = require('./nodemailer/NodemailerSettings');
const UserOTPVerification = require('./models/UserOTPVerification');
const movie = require('./models/MovieModel');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//app.use(cors());
app.use(express.static("public"));

// Set EJS as templating engine
app.set("view engine", "ejs");

app.use(express.static("build"));


const mongoUrl = process.env.MONGOURL;

const mailUser = process.env.ZOHOUSER;

const saltRoundString = process.env.SALTROUNDS;
const saltRounds = parseInt(saltRoundString);

mongoose.connect(mongoUrl,
    { useNewUrlParser: true, useUnifiedTopology: true }, (err) => {
        if (err) {
            console.log(err)
        } else {
            console.log('connected');
        }
    });


const multer = require('multer');
const { forEach } = require('lodash');

const storage = multer.diskStorage({
    destination: (req, file, cb) => { 

        cb(null, 'uploads') 

    }, 

    filename: (req, file, cb) => { 

        cb(null, file.fieldname + '-' + Date.now()) 

    } 
  });

  const upload = multer({ storage });

  app.get('/fresh/new', (req, res)=> {
      movie.find({}, (err, items)=> {
          if(err) {
              console.log(err)
          } else {
            res.render('new', {items: items})
          }
      });
  });

  app.post('/fresh/new', upload.single('image'), (req, res, next)=> {
    const {name, category, type, rating, description, snvl, trailer, download} = req.body;

    const newMovie = new movie ({
        name,
        category,
        type,
        rating,
        snvl,
        trailer,
        download,
        description,
        img: { 
            
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)), 

            contentType: 'image/*'

        }
    });
    newMovie.save();
    res.redirect('/fresh/new');
  });

  app.get('*', (req, res)=> {
    app.use(express.static("build"));
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

  app.post('/movie-delete', (req, res)=> {
      const {id} = req.body;
      movie.findOneAndDelete({_id: id}, (err, docs)=> {
          if(err) {
              console.log(err);
          } else {
              res.redirect('/fresh/new');
          }
      })
  });

  app.post('/edit-user', upload.single('image'), (req, res, next)=> {
      const {id} = req.body;
    const firstName = _.upperFirst(req.body.firstName);
    const lastName = _.upperFirst(req.body.lastName);
    User.findOneAndUpdate({_id: id}, {
        firstName,
        lastName,
        img: { 
            
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)), 

            contentType: 'image/*'

        }
    }, null, (updateErr, updateDocs)=> {
        if(updateErr) {
            console.log(updateErr);
            res.send({
                message: "Server Error!... Please try again",
                user: {},
                image: {}
            });
        } else {
            User.findOne({_id: id}, (findErr, user)=> {
                if(findErr) {
                    console.log(findErr);
                    res.send({
                        message: "Server Error!... Please try again",
                        user: {},
                        image: {}
                    });
                } else if(!user) {
                    res.send({
                        message: "Server Error!... Please try again",
                        user: {},
                        image: {}
                    });
                } else {
                    const image = `data:user/${user.img.contentType};base64,${user.img.data.toString('base64')}`
                    res.send({
                        message: "Success!!",
                        user: user,
                        image: image
                    });
                }
            })
        }
    })
  });

  app.post('/delete-user', (req, res, next)=> {
      const {id} = req.body;
      User.findOneAndDelete({_id: id}, (err, docs)=> {
          if(err) {
              res.send({
                  message: "Server Error...",
                  moreInfo: "Couldn't preform your request... please try again."
              })
          } else {
              res.send({
                message: "Success!!",
                moreInfo: ""
              })
          }
      })
  });

app.post('/register',upload.single('image'), (req, res, next) => {
    const firstName = _.upperFirst(req.body.firstName);
    const lastName = _.upperFirst(req.body.lastName);
    const email = _.lowerFirst(req.body.email);
    const password = req.body.password;
 
        User.findOne({ email: email }, (err, userItems)=> {
            if(err) {
                console.log(err);
                res.send({
                    message: "Server Error! Please Try Again.",
                    user: {}
                })
            } else if(userItems) {
                res.send({
                    message: "Looks Like You've Already Registered... Try Login",
                    user: {}
                });
            } else if(password.length < 8) {
                res.send({
                    message: "Password must be 8 characters or greater", 
                    user: {}
                })
            } else {
                bcrypt.hash(password, saltRounds, function(err, hash){

                    const person = new User ({
                        firstName,
                        lastName,
                        email: email,
                        password: hash,
                        verified: false,
                        favourites: [],
                        recents: [],
                        img: { 
            
                            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)), 
                
                            contentType: 'image/*'
                
                        }
                    });
                    person.save()
                    .then((user)=> {
                        UserOTPVerification.findOneAndDelete({userId: user._id}, (delError, docs)=> {
                            if(delError) {
                                console.log(delError);
                                res.send({
                                    message: "Server Error! Please Try Again.",
                                    user: {}
                                });
                            } else {
                                sendOTPVerificationEmail(user, res);
                            }
                        })
                    })
                    .catch((error)=> {
                        console.log(error);
                        res.send({
                            message: "Server Error! Please Try Again.",
                            user: {}
                        });
                    });
                });
        
            }
        })
});

const sendOTPVerificationEmail = async (user, res) => {
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;

    //mail options
    const mailOptions = {
        from: mailUser,
        to: user.email,
        subject: "Confirm Your Email",
        html: `<div>
        <img style="width:100%" src="cid:logo">
        <p>Hello ${user.firstName} and welcome to Rillo Movies. To complete your registration, please enter the otp below. This OTP <b>expires in an hour</b></p>
        <p>From all of us at <a href="https://rillo-movies.netlify.app" style="text-decoration: none; color: hsl(270, 9%, 13%);">Rillo-Movies.</a></p>
        <br>
        <br>
        <h1 style="text-align: center; padding: 10px 15px; background: #d4cfd9">${otp}</h1>
        </div>`,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/public/images/logo.png',
            cid: 'logo'
        }]
    }

    const newOTPVerification = await new UserOTPVerification({
        userId: user._id,
        otp: otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    //save otp record
    transporter.sendMail(mailOptions, (err, info)=> {
        if(err) {
            console.log(err);
            res.send({
                message: "Server Error! Please Try Again.",
                user: {}
            });
        } else {
            newOTPVerification.save()
            .then((otp)=> {
                res.send({
                    message: "Success!!",
                    user: user
                });
            })
            .catch((error)=> {
                console.log(error);
                res.send({
                    message: "Server Error! Please Try Again.",
                    user: {}
                });
            })
        }
    });
}

app.post('/verifyuser', (req, res)=> {
    const {id, otp} = req.body;
    UserOTPVerification.findOne({userId: id}, (err, otpDetails)=> {
        const expiresAt = otpDetails.expiresAt;
        if(err) {
            res.send({
                message: "Server Error! Please Try Again!",
                user: ""
            });
        } else if(!otpDetails) {
            res.send({
                message: "No OTP found for this account. Please click the 'Send Again' button and try again.",
                user: ""
            });
        } else if(expiresAt < Date.now()) {
            UserOTPVerification.findOneAndDelete({userId: id}, (fail, docs)=> {
                if(fail) {
                    res.send({
                        message: "Server Error! Please Try Again!",
                        user: ""
                    });
                } else {
                    res.send({
                        message: "OTP has expired... Please Click 'Send again' to generate another.",
                        user: ""
                    })
                }
            })
        } else if(!(otp === otpDetails.otp)) {
            res.send({
                message: "Incorrect OTP... Try Again",
                user: ""
            });
        } else {
            UserOTPVerification.findOneAndDelete({userId: otpDetails.userId}, (delErr, delDocs)=> {
                if(delErr) {
                    res.send({
                        message: "Internal Server Error... Please try again.", 
                        user: {}
                    });
                } else {
                    User.findOneAndUpdate({_id: otpDetails.userId}, {verified: true}, null, (updateErr, updateDocs)=> {
                        if(updateErr) {
                            res.send({
                                message: "Server Error... Please Try Again.",
                                user: {}
                            });
                        } else {
                            User.findOne({_id: id}, (findErr, findUser)=> {
                                if(findErr) {
                                    res.send({
                                        message: "Server Error! Please Try Again.", 
                                        user: {}
                                    });
                                } else if(!findUser) {
                                    res.send({
                                        message: "Server Error! Please Try Again.", 
                                        user: {}
                                    });
                                } else {
                                    res.send({
                                        message: "Success!!",
                                        user: findUser
                                    })
                                }
                            })
                        }
                    });
                }
            })
        }
    })
});

app.post('/resendVerification', (req, res)=> {
    const {email, id, fName} = req.body;
    //delete existing otp and resend
    UserOTPVerification.findOneAndDelete({userId: id}, (err, docs)=> {
        if(err) {
            res.send({
                message: "Server Error... Please Try Again.", 
                user: {}
            });
        } else {
            resendOTPVerficationEmail(email, id, fName, res);
        }
    })
});

const resendOTPVerficationEmail = async (email, id, fName, res)=> {
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;

    //mail options
    const mailOptions = {
        from: mailUser,
        to: email,
        subject: "Confirm Your Email",
        html: `<div>
        <img style="width:100%" src="cid:logo">
        <p>Hello ${fName} and welcome to Rillo Movies. To complete your registration, please enter the otp below. This OTP <b>expires in an hour</b></p>
        <p>From all of us at <a href="https://rillo-movies.netlify.app" style="text-decoration: none; color: hsl(270, 9%, 13%);">Rillo-Movies.</a></p>
        <br>
        <br>
        <h1 style="text-align: center; padding: 10px 15px; background: #d4cfd9">${otp}</h1>
        </div>`,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/public/images/logo.png',
            cid: 'logo'
        }]
    }

    const newOTPVerification = await new UserOTPVerification({
        userId: id,
        otp: otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    //save otp record
    transporter.sendMail(mailOptions, (err, info)=> {
        if(err) {
            console.log(err);
            res.send({
                message: "Server Error! Please Try Again.",
                user: {}
            });
        } else {
            newOTPVerification.save()
            .then((otp)=> {
                res.send({
                    message: "Success!!",
                    user: {}
                });
            })
            .catch((error)=> {
                console.log(error);
                res.send({
                    message: "Server Error! Please Try Again.",
                    user: {}
                });
            })
        }
    });
}

app.post('/forgotpass', (req, res)=> {
    const {email} = req.body;

    User.findOne({email: email}, (err, user)=> {
        if(err) {
            res.send({
                message: "Internal Server Error...Please Try Again.",
                user: {}
            });
        } else if(!user) {
            res.send({
                message: "User Not Found...",
                user: {}
            });
        } else {
            UserOTPVerification.findOneAndDelete({userId: user._id}, (delErr, delDocs)=> {
                if(delErr) {
                    res.send({
                        message: "Internal Server Error... Please Try Again"
                    })
                } else {
                    sendOTPPassChange(user, res);
                }
            })
        }
    });
});

const sendOTPPassChange =async (user, res)=> {
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;

    //mail options
    const mailOptions = {
        from: mailUser,
        to: user.email,
        subject: "Change Your Password",
        html: `<div>
        <img style="width:100%" src="cid:logo">
        <p>Hello ${user.firstName}, a request to change your password has been triggered. To password your password, please enter the otp below. This OTP <b>expires in an hour</b> and <b>DO NOT</b> share this OTP with anyone.</p>
        <p>From all of us at <a href="https://rillo-movies.netlify.app" style="text-decoration: none; color: hsl(270, 9%, 13%);">Rillo-Movies.</a></p>
        <br>
        <br>
        <h1 style="text-align: center; padding: 10px 15px; background: #d4cfd9">${otp}</h1>
        </div>`,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/public/images/logo.png',
            cid: 'logo'
        }]
    }

    const newOTPVerification = await new UserOTPVerification({
        userId: user._id,
        otp: otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    //save otp record
    transporter.sendMail(mailOptions, (err, info)=> {
        if(err) {
            console.log(err);
            res.send({
                message: "Server Error! Please Try Again.",
                user: {}
            });
        } else {
            newOTPVerification.save()
            .then((otp)=> {
                res.send({
                    message: "Success!!",
                    user: user
                });
            })
            .catch((error)=> {
                console.log(error);
                res.send({
                    message: "Server Error! Please Try Again.",
                    user: {}
                });
            })
        }
    });
}

app.post('/resendForgotOtp', (req, res)=> {
    const {email, id, fName} = req.body;
    //delete existing otp and resend
    UserOTPVerification.findOneAndDelete({userId: id}, (err, docs)=> {
        if(err) {
            res.send({
                message: "Server Error... Please Try Again.", 
                user: {}
            });
        } else {
            resendOTPPassChange(email, id, fName, res);
        }
    })
});

const resendOTPPassChange = async (email, id, fName, res)=> {
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;

    //mail options
    const mailOptions = {
        from: mailUser,
        to: email,
        subject: "Change Your Password",
        html: `<div>
        <img style="width:100%" src="cid:logo">
        <p>Hello ${fName}, a request to change your password has been triggered. To password your password, please enter the otp below. This OTP <b>expires in an hour</b> and <b>DO NOT</b> share this OTP with anyone.</p>
        <p>From all of us at <a href="https://rillo-movies.netlify.app" style="text-decoration: none; color: hsl(270, 9%, 13%);">Rillo-Movies.</a></p>
        <br>
        <br>
        <h1 style="text-align: center; padding: 10px 15px; background: #d4cfd9">${otp}</h1>
        </div>`,
        attachments: [{
            filename: 'logo.png',
            path: __dirname + '/public/images/logo.png',
            cid: 'logo'
        }]
    }

    const newOTPVerification = await new UserOTPVerification({
        userId: id,
        otp: otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
    });

    //save otp record
    transporter.sendMail(mailOptions, (err, info)=> {
        if(err) {
            console.log(err);
            res.send({
                message: "Server Error! Please Try Again.",
                user: {}
            });
        } else {
            newOTPVerification.save()
            .then((otp)=> {
                res.send({
                    message: "Success!!",
                    user: {}
                });
            })
            .catch((error)=> {
                console.log(error);
                res.send({
                    message: "Server Error! Please Try Again.",
                    user: {}
                });
            })
        }
    });
}

app.post('/forgotOtp', (req, res)=> {
    const {id, otp} = req.body;
    UserOTPVerification.findOne({userId: id}, (err, otpDetails)=> {
        const expiresAt = otpDetails.expiresAt;
        if(err) {
            res.send({
                message: "Server Error! Please Try Again!",
                user: ""
            });
        } else if(!otpDetails) {
            res.send({
                message: "No OTP found for this account. Please click the 'Send Again' button and try again.",
                user: ""
            });
        } else if(expiresAt < Date.now()) {
            UserOTPVerification.findOneAndDelete({userId: id}, (fail, docs)=> {
                if(fail) {
                    res.send({
                        message: "Server Error! Please Try Again!",
                        user: ""
                    });
                } else {
                    res.send({
                        message: "OTP has expired... Please Click 'Send again' to generate another.",
                        user: ""
                    })
                }
            })
        } else if(!(otp === otpDetails.otp)) {
            res.send({
                message: "Incorrect OTP... Try Again",
                user: ""
            });
        } else {
            User.findOne({_id: otpDetails.userId}, (findErr, findItems)=> {
                if(findErr) {
                    res.send({
                        message: "Internal Server Error... Please Try Again",
                        user: {}
                    })
                } else {
                    res.send({
                        message: "Success!!",
                        user: findItems
                    });
                }
            })
        }
    })
});

app.post('/changePass', (req, res)=> {
    const {password, confirmPassword, id} = req.body;
    console.log(id + "Outside");

    if(!(password === confirmPassword)) {
        console.log(id + "Incorrect");
        res.send({
            message: "Passwords do not match.",
            user: {}
        })
    } else {
        bcrypt.hash(password, saltRounds, (err,hash)=> {
            console.log(id + "before If Else Hash");
            if(err) {
                res.send({
                    message: "Internal Server Error... Please Try Again.",
                    user: {}
                });
            } else {
                console.log(id + "Else hash");
                User.findOneAndUpdate({_id: id}, {password: hash}, null, (updateErr, updateDocs)=> {
                    if(updateErr) {
                        res.send({
                            message: "Server Error... Please Try Again.",
                            user: {}
                        });
                    } else {
                        res.send({
                            message: "Success!!",
                            user: {}
                        });
                    }
                })
            }
        });
    }
});

app.post('/login',function(req, res){
    const email = _.lowerFirst(req.body.email);
    const password = req.body.password;

    User.findOne({ email: email }, (err, items) => {

        if(err) {
            res.send({
                message: "Server Error...Please Try Again.",
                user: {}
            })
        }
        else if(!items) {
            res.send({
                message: "User Not Found",
                user: {}
            });
        } else if(!items.verified) {
            res.send({
                message:"Redirect!!",
                user: items
            })
        } else {
                bcrypt.compare(password, items.password, function(err, response){
                        if(response === true){
                            res.send({
                                message: "Success!!",
                                user: items
                            })
                        } else {
                            res.send({
                                message: "Incorrect password. Please try again",
                                user: {}
                            })
                        }
                });
        }
    });
});

app.post('/user/:userId', (req, res, next)=> {
    const {userId} = req.params;
    console.log(userId);
    User.findOne({_id: userId}, (err, user)=> {
        if(err) {
            console.log(err);
            res.send({
                message: "Could not retrieve profile picture",
                img: {}
            });
            next();
        } else if(!user) {
            console.log("!user");
            res.send({
                message: "Could not retrieve profile picture",
                img: {}
            });
            next();
        } else {
            const image = `data:user/${user.img.contentType};base64,${user.img.data.toString('base64')}`
            res.send({
                message: "Success!",
                img: image
            });
            next();
        }
    })
})

app.post('/home', function(req, res, next){
    movie.find({}, (err, items) => {
        if (err) {
            console.log(err);
            res.send({
                message: "Database Error... Please try refreshing the page",
                movies: {}
            });
            next();
        } else if(!items) {
            res.send({
                message: "Could not retrieve movies... Please try refreshing the page",
                movies: {}
            });
            next();
        } else {
            let movies = [];
            items.forEach(item=> {
                let movieStat = {
                    _id: item._id,
                    name: item.name,
                    category: item.category,
                    type: item.type,
                    rating: item.rating,
                    snvl: item.snvl,
                    trailer: item.trailer, 
                    download: item.download,
                    description: item.description,
                    img: `data:item/${item.img.contentType};base64,${item.img.data.toString('base64')}`
                };
                movies.push(movieStat);
            });
            res.send({
                message: "Success!!",
                movies
            });
            next();
        }
    });
});

app.post('/fav', (req, res, next)=> {
    const {userId, movieId} = req.body;
    User.findOne({_id: userId}, (findErr, findItems)=> {
        if(findErr) {
            res.send({
                message: "Could not get database... please try refreshing the page",
                userDetails: {}
            });
            next();
        } else if(findItems.favourites.includes(movieId)) {
            const filter = findItems.favourites.filter(filteredItems => !(filteredItems === movieId));
            User.findOneAndUpdate({_id: findItems._id}, {favourites: filter}, null, (updateErr, updateDocs)=> {
                if(updateErr) {
                    res.send({
                        message: "Could not get database... please try refreshing the page",
                        userDetails: {}
                    });
                    next();
                } else {
                    User.findOne({_id: findItems._id}, (err, items)=> {
                        if(err) {
                            res.send({
                                message: "Could not remove like...",
                                userDetails: {}
                            });
                            next();
                        } else {
                            res.send({
                                message: "Success!!",
                                userDetails: items
                            });
                            next();
                        }
                    });
                }
            });
        } else {
            User.findOneAndUpdate({_id: findItems._id}, {favourites: [...findItems.favourites, movieId]}, null, (updateErr, updateDocs)=> {
                if(updateErr) {
                    res.send({
                        message: "Could not like movie...",
                        userDetails: {}
                    });
                    next();
                } else {
                    User.findOne({_id: userId}, (err, items)=> {
                        if(err) {
                            res.send({
                                message: "Could not get database... please try refreshing the page",
                                userDetails: {}
                            });
                            next();
                        } else {
                            res.send({
                                message: "Success!!",
                                userDetails: items
                            });
                            next();
                        }
                    });
                }
            });
        }
    });
});


app.post('/recent', (req, res, next)=> {
    const {userId, movieId} = req.body;
    User.findOne({_id: userId}, (findErr, findItems)=> {
        if(findErr) {
            res.send({
                message: "Could not get database... please try refreshing the page",
                userDetails: {}
            });
            next();
        } else if(findItems.recents.length > 4) {
            const firstRecent = findItems.recents[0];
            const filteredArray = findItems.recents.filter(filteredItems => !(filteredItems === firstRecent));

            User.findOneAndUpdate({_id: findItems._id}, {recents: filteredArray}, null, (updateErr, updateDocs)=> {
                if(updateErr) {
                    res.send({
                        message: "Could not get database... please try refreshing the page",
                        userDetails: {}
                    });
                    next();
                } else {
                    User.findOne({_id: userId}, (updateFindErr, updateFindItems)=> {
                        if(updateFindErr) {
                            res.send({
                                message: "Could not get database... please try refreshing the page",
                                userDetails: {}
                            });
                            next();
                        } else if(updateFindItems.recents.includes(movieId)) {
                            const filter = updateFindItems.recents.filter(filteredItems=> !(filteredItems === movieId));
                            User.findOneAndUpdate({_id: findItems._id}, {recents: filter}, null, (updateErr, updateDocs)=> {
                                if(updateErr) {
                                    res.send({
                                        message: "Could not get database... please try refreshing the page",
                                        userDetails: {}
                                    });
                                    next();
                                } else {
                                    const recentArray = [...filter, movieId];
                                            User.findOneAndUpdate({_id: findItems._id}, {recents: recentArray}, null, (updateErr, updateDocs)=> {
                                                if(updateErr) {
                                                    res.send({
                                                        message: "Could not get database... please try refreshing the page",
                                                        userDetails: {}
                                                    });
                                                    next();
                                                } else {
                                                    User.findOne({_id: findItems._id}, (err, items)=> {
                                                        if(err) {
                                                            res.send({
                                                                message: "Could not add recent...",
                                                                userDetails: {}
                                                            });
                                                            next();
                                                        } else {
                                                            res.send({
                                                                message: "Success!!",
                                                                userDetails: items
                                                            });
                                                            next();
                                                        }
                                                    });
                                                }
                                            });
                                }
                            });
                        } else {
                            User.findOneAndUpdate({_id: findItems._id}, {recents: [...updateFindItems.recents, movieId]}, null, (updateErr, updateDocs)=> {
                                if(updateErr) {
                                    res.send({
                                        message: "Could not like movie...",
                                        userDetails: {}
                                    });
                                    next();
                                } else {
                                    User.findOne({_id: userId}, (err, items)=> {
                                        if(err) {
                                            res.send({
                                                message: "Could not get database... please try refreshing the page",
                                                userDetails: {}
                                            });
                                            next();
                                        } else {
                                            res.send({
                                                message: "Success!!",
                                                userDetails: items
                                            });
                                            next();
                                        }
                                    });
                                }
                            });
                        }
                    })
                }
            });
        } else if(findItems.recents.includes(movieId)) {
            const filter = findItems.recents.filter(filteredItems => !(filteredItems === movieId));
            User.findOneAndUpdate({_id: findItems._id}, {recents: filter}, null, (updateErr, updateDocs)=> {
                if(updateErr) {
                    res.send({
                        message: "Could not get database... please try refreshing the page",
                        userDetails: {}
                    });
                    next();
                } else {
                    const recentArray = [...filter, movieId];
                            User.findOneAndUpdate({_id: findItems._id}, {recents: recentArray}, null, (updateErr, updateDocs)=> {
                                if(updateErr) {
                                    res.send({
                                        message: "Could not get database... please try refreshing the page",
                                        userDetails: {}
                                    });
                                    next();
                                } else {
                                    User.findOne({_id: findItems._id}, (err, items)=> {
                                        if(err) {
                                            res.send({
                                                message: "Could not add recent...",
                                                userDetails: {}
                                            });
                                            next();
                                        } else {
                                            res.send({
                                                message: "Success!!",
                                                userDetails: items
                                            });
                                            next();
                                        }
                                    });
                                }
                            });
                }
            });
        } else {
            User.findOneAndUpdate({_id: findItems._id}, {recents: [...findItems.recents, movieId]}, null, (updateErr, updateDocs)=> {
                if(updateErr) {
                    res.send({
                        message: "Could not like movie...",
                        userDetails: {}
                    });
                    next();
                } else {
                    User.findOne({_id: userId}, (err, items)=> {
                        if(err) {
                            res.send({
                                message: "Could not get database... please try refreshing the page",
                                userDetails: {}
                            });
                            next();
                        } else {
                            res.send({
                                message: "Success!!",
                                userDetails: items
                            });
                            next();
                        }
                    });
                }
            });
        }
    });
});


app.post('/search', (req, res, next)=> {
    const {search} = req.body;
    const regex = new RegExp(escapeRegex(search), 'gi');

        movie.find({name: regex}, (err, items) => {
            if (err) {
                res.send({
                    message: "Could not get database... please try refreshing the page",
                    movies: {}
                });
                next();
            } else if(!items) {
                console.log('None')
                res.send({
                    message: "None",
                    movies: {}
                });
                next();
            } else {
                let movies = [];
                items.forEach(item=> {
                    let movieStat = {
                        _id: item._id,
                        name: item.name,
                        category: item.category,
                        type: item.type,
                        rating: item.rating,
                        snvl: item.snvl,
                        trailer: item.trailer, 
                        download: item.download,
                        description: item.description,
                        img: `data:item/${item.img.contentType};base64,${item.img.data.toString('base64')}`
                    };
                    movies.push(movieStat);
                });
                res.send({
                    message: "found!!",
                    movies: movies
                });
                next();
            }
        });
});


function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

let port = process.env.PORT || 4000;

app.listen(port, err => {
    if (err)
        throw err
    console.log('Server listening on port ' + port)
});
