var express = require('express');
var router = express.Router();
var passport = require('passport');
var pg = require('pg')
var bcrypt = require('bcryptjs');
var Promise = require('promise');
var conString = "pg://vargash1:guest@localhost:5432/vtodo_db";
var dbclient = new pg.Client(conString);

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('user');
});

router.get('/login',
  function(req, res){
    res.render('login');
  });

router.post('/login',
  passport.authenticate('local', { failureRedirect: 'login' }),
  function(req, res,next) {
    // res.json(req.user);
    res.redirect('profile');
  });

router.get('/logout',
  function(req, res){
    req.logout();
    res.redirect('/');
  });

function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.redirect('login');
  }
}

router.get('/profile',
  loggedIn,
  function(req, res){
      res.render('profile', { user: req.user });
  });

router.get('/signup',
  function(req, res) {
    // If logged in, go to profile page
    if(req.user) {
      res.redirect('profile');
    }
    res.render('signup');
  });

function validUsername(username) {
  var login = username.trim();
  return login !== '' && login.search(/ /) < 0;
}
// i have no clue
function validEmail(email){
    var wtf = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return wtf.test(email);
}

function validPassword(password) {
  var pass = password.trim();
  return pass !== '' &&
    pass.length >= 8 &&
    pass.search(/[a-z]/) >= 0 &&
    pass.search(/[A-Z]/) >= 0 &&
    pass.search(/[0-9]/) >= 0;
}

router.post('/signup',
  function(req, res, next) {
    // Reject non-users
    if (!validUsername(req.body.username)) {
        console.log("invalid username");
        return res.render('signup');
    }
    //Reject invalid emails
    if (!validEmail(req.body.email)){
        console.log("invalid email");
        return res.render('signup')
    }
    // Reject weak passwords
    if (!validPassword(req.body.password)) {
        console.log("invalid password");
        return res.render('signup');
    }
    // Generate a hashed password
    var hashedPassword = new Promise(function(resolve, reject){
      var salt = bcrypt.genSaltSync(10);
      console.log("hash passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });
    // Connect to database
    var db = new Promise(function(resolve, reject) {
    dbclient.connect(function(err, client, next) {
        console.log(err);
        console.log("[INFO] Connected to DB");
        if (err) {
            reject(Error("Unable to connect to database"));
        }
        else {
            resolve({'client':client,'next':next});
        }
      });
    }).then(function(data) {
      // Check if they're already a user
      return new Promise(function(resolve, reject) {
        console.log("[INFO] Querying DB");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.body.username], function(err, result) {
        if (err) {
            console.log(err);
            console.log("[INFO] Unable to Query DB");
            reject(Error("Unable to query database"));
        }
        else if (result.rows.length > 0) {
            data.next();
            console.log("[INFO] User with username already exists");
            reject(Error("User exists"));
        }
        else {
            console.log("[INFO] Username available.");
            resolve(data);
        }
        });
      });
    });
    // If we have a legit password,
    // and nobody else has the account,
    // create the user
    Promise.all([hashedPassword, db]).then(function(data) {
      console.log("[INFO] Created account");
      data[1].client.query('INSERT INTO users (username,email,password) VALUES($1,$2,$3)', [req.body.username, req.body.email, data[0]], function(err, result) {
        data.next();
      });
    });
    res.render('index',{title: 'Sucessful Signup'});
  });


module.exports = router;
