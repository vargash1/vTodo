var express = require('express');
var router = express.Router();
var passport = require('passport');
var pg = require('pg')
var bcrypt = require('bcryptjs');
var Promise = require('promise');
var conString = "pg://vargash1:guest@localhost:5432/vtodo_db";

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('user',{user: req.user});
});

router.get('/login',
  function(req, res){
    res.render('login',{user: req.user});
  });

router.post('/login',
  passport.authenticate('local', { failureRedirect: 'login'}),
  function(req, res, next) {
    // res.json(req.user);
    res.render('profile',{user: req.user});
  });

router.get('/logout',
  function(req, res){
    req.logout();
    res.render('user',{user: req.user});
  });

function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.render('login',{ user: req.user });
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
      res.render('profile',{user: req.user});
    }
    res.render('signup',{user: req.user});
  });

router.get('/addtask',
    loggedIn,
    function(req, res){
        res.render('addtask',{user: req.user, msg: "True"});
    });
router.post('/addtask',
    function(req, res, next){
        var db = new Promise(function(resolve,reject){
        pg.connect(conString,function(err, client, done){
            console.log("[INFO] Connected to DB");
            if(err){
                reject(Error("Unable to Connect to DB"));
            }else{
                resolve({'client':client,'done':done});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                console.log("[INFO] Querying DB");
                data.client.query('SELECT * FROM notes WHERE title=$1',[req.body.title], function(err,result){
                    if (err){
                        console.log(err);
                        console.log("[INFO] Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length > 0){
                        console.log("[INFO] Task with Title already exists");
                        reject(Error("Task with Title already exists!"));
                    }
                    else{
                        console.log("[INFO] Task Title available, adding Task");
                        resolve(data);
                    }
                });
            });
        });
        Promise.all(db).then(function(data) {
            console.log("[INFO] Created Task");
            data[0].client.query('INSERT INTO notes (username,title,datedue,timedue,taskbody) VALUES($1,$2,$3,$4,$5)',
            [req.user,req.body.tasktitle, req.body.datedue,req.body.timedue,req.body.taskbody],
            function(err, result) {
                res.render('profile',{user: req.user});
            });
        },function(reason){
            console.log("[INFO] Unable to create task");
            res.render('addtask',{message:reason})
        });
});

function validUsername(username) {
  var login = username.trim();
  var ugex = /^[a-zA-Z0-9]+$/;
  return login.search(/ /) < 0 &&
    login !== '' &&
    ugex.test(login) &&
    login.length >= 5;

}

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
        console.log("[INFO] Invalid Username!");
        return res.render('signup', {message: "Invalid Username!"});
    }
    //Reject invalid emails
    if (!validEmail(req.body.email)){
        console.log("[INFO] Invalid Email");
        return res.render('signup',{message: "Invalid Email!"})
    }
    // Reject weak passwords
    if (!validPassword(req.body.password)) {
        console.log("[INFO] Invalid Password");
        return res.render('signup',{message: "Invalid Password!"});
    }
    // Generate a hashed password
    var hashedPassword = new Promise(function(resolve, reject){
      var salt = bcrypt.genSaltSync(10);
      console.log("[INFO] Hash Passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(conString,function(err, client, done) {
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
        console.log("[INFO] Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1 or email=$2',[req.body.username,req.body.email], function(err, result) {
            if (err) {
                console.log(err);
                console.log("[INFO] Unable to Query DB");
                reject(Error("Unable to query database"));
            }
            else if (result.rows.length > 0) {
                console.log("[INFO] User with username or email already exists");
                reject(Error("Username or Email Already In Use!"));
            }
            else {
                console.log("[INFO] Username and Email Available.");
                resolve(data);
            }
            });
        });
    });
    Promise.all([hashedPassword, db]).then(function(data) {
      console.log("[INFO] Created account");
      data[1].client.query('INSERT INTO users (username,email,password) VALUES($1,$2,$3)',
        [req.body.username, req.body.email, data[0]],
        function(err, result) {
            msg = 'Successful Signup, Please sign in to your account '.concat([req.body.username]);
            res.render('login',{message: msg});
        });
    },function(reason){
      console.log("[INFO] Unable to Create Account");
      res.render('signup',{message:reason})
    });

});

module.exports = router;
