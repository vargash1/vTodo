/**
* @Author: Vargas Hector <vargash1>
* @Date:   Wednesday, March 30th 2016, 5:34:31 pm
* @Email:  vargash1@wit.edu
* @Last modified by:   vargash1
* @Last modified time: Thursday, March 31st 2016, 11:35:38 pm
*/

var express = require('express');
var router = express.Router();
var passport = require('passport');
var pg = require('pg')
var bcrypt = require('bcryptjs');
var Promise = require('promise');
require('dotenv').config();

/* GET users listing. */
router.get('/',
    function(req, res, next) {
        if (req.user){
            fetchTasks(req,res,function(usertasks) {
                res.render('user',{user: req.user,tasks:usertasks});
            });
        } else {
            res.render('user',{user: req.user, tasks:[]});
        }
    });

router.get('/settings',
    loggedIn,
    function(req,res,next){
        console.log(req.user);
        fetchInfo(req,res,function(dbdata){
            if( dbdata[0] != null && dbdata[0] != undefined){
                res.render('settings',{
                    user: req.user,
                    msg: "True",
                    email:  dbdata[0].email,
                    numtasks: dbdata.length
                });
            }
        });
    });

// change user email
router.get('/chemail',
    loggedIn,
    function(req,res){
        res.render('chemail',{user: req.user, msg: "True"});
    });

router.get('/chpasswd',
    loggedIn,
    function(req,res){
        res.render('chpasswd',{user: req.user, msg: "True"});
    });

router.get('/login',
    function(req, res){
        res.render('login',{user: req.user});
    });

router.post('/login',
  passport.authenticate('local', { failureRedirect: 'login'}),
  function(req, res, next) {
      if (req.user){
          fetchTasks(req,res,function(usertasks) {
              res.render('user',{user: req.user, tasks:usertasks});
        });
      }
  });

router.get('/logout',
  function(req, res){
    req.logout();
    res.render('user',{user: req.user, tasks:[]});
  });

function loggedIn(req, res, next) {
    if (req.user) {
        next();
    }
    else{
        res.render('login',{ user: req.user });
    }
 }

router.get('/signup',
  function(req, res) {
    // If logged in, go to profile page
    if(req.user) {
        fetchTasks(req,res,function(usertasks){
            res.render('user',{user: req.user, tasks:usertasks});
        });
    }
    res.render('signup',{user: req.user});
  });

router.get('/addtask',
    loggedIn,
    function(req, res){
        res.render('addtask',{user: req.user, msg: "True"});
    });

router.get('/modifytask',
    loggedIn,
    function(req,res){
        fetchTasks(req,res,function(usertasks){
            res.render('user',{user: req.user, tasks:usertasks});
        });
    });

// checking for valid tasks
function validTaskTitle(ttitle){
    var modtitle = ttitle.trim();
    return  modtitle !== '' && modtitle.length >= 3;
}

function validTaskBody(tbody){
    var modbody = tbody.trim();
    return modbody !== '' && modbody.length >= 3;
}

function validTime(ttime){
    var modtime = ttime.trim();
    return modtime !== '';
}

function validDate(tdate){
    var moddate = tdate.trim();
    return moddate !== '';
}

// Fetches all tasks in database that belong to the user
function fetchTasks(req, res, next){
    console.log("[INFO] Connecting to Database");
    pg.connect(process.env.CONSTRING, function(err,client,done){
        if(err){
            console.error("[INFO] Unable to Connect to Database");
        }
        console.log("[INFO] Querying Database");
        client.query('SELECT noteid,title,to_char(datedue, \'MM-DD-YYYY\'),timedue,taskbody FROM notes WHERE username=$1 ORDER BY noteid DESC',[req.user.username],
        function(err,result){
            if (err){
                console.error("[INFO] Unable to Query DB");
            }
            else if (result.rows.length > 0){
                done();
                console.log("[INFO] Released Client Back Into Pool");
                console.log("[INFO] User's Tasks Found");
                next(result.rows);
            }else{
                console.log("[INFO] No Tasks Where Found!");
                next([]);
            }
        });
    });
}
// Adds a task to the Database
router.post('/addtask',
    function(req, res, next){

        // Reject invalid task title
        if (!validTaskTitle(req.body.tasktitle)) {
            console.log("[INFO] Invalid Task Title!");
            return res.render('addtask',{
                message: "Invalid Task Title!",
                rules: "Task Title must be at least 3 characters long!"
            });
        }
        //Reject invalid task body
        if (!validTaskBody(req.body.taskbody)){
            console.log("[INFO] Invalid Task Body!");
            return res.render('addtask',{
                message: "Invalid Task Body!",
                rules: "Task Body must compose of at least 3 characters!"
            });
        }
        //Reject invalid task date and time
        if (!validDate(req.body.datedue) || !validTime(req.body.timedue)){
            console.log("[INFO] Invalid Date/Time!");
            return res.render('addtask',{
                    message: "Invalid Task Time/Date!",
                    rules: "Please Make Sure Task Time/Date is Valid!"
                });
        }


        var db = new Promise(function(resolve,reject){
        console.log("[INFO] Connecting to Database");
        pg.connect(process.env.CONSTRING,function(err, client, next){
            if(err){
                reject(Error("Unable to Connect to DB"));
            }
            else{
                resolve({'client':client,'next':next});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                console.log("[INFO] Querying Database");
                data.client.query('SELECT * FROM notes WHERE title=$1 AND username=$2',[req.body.tasktitle,req.user.username],
                function(err,result){
                    if (err){
                        console.log(err);
                        console.error("[INFO] Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length  > 0){
                        data.next();
                        console.log("[INFO] Task with Title already exists");
                        console.log("[INFO] Released Client Back Into Pool");
                        reject(Error("Task with Title already exists!"));
                    }
                    else{
                        console.log("[INFO] Task Title available, adding Task");
                        resolve(data);
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            console.log("[INFO] Querying Database");
            data[0].client.query('INSERT INTO notes (username,title,datedue,timedue,taskbody) VALUES($1,$2,$3,$4,$5)',
            [req.user.username, req.body.tasktitle, req.body.datedue, req.body.timedue, req.body.taskbody],
            function(err, result) {
                if(err){
                    console.log("[INFO] Unable To Insert Note into Database");
                    console.error(err);
                }
                data[0].next();
                console.log("[INFO] Created Task");
                console.log("[INFO] Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                    res.render('user',{user:req.user,tasks:usertasks});
                });
            });
        },function(reason){
            console.log("[INFO] Unable to Create Task");
            res.render('addtask',{user : req.user,message:reason})
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

// Handle new signup
router.post('/signup',
  function(req, res, next) {

    // Reject invalid username
    if (!validUsername(req.body.username)) {
        console.log("[INFO] Invalid Username!");
        return res.render('signup',{
            message: "Invalid Username!",
            rules: [
                { rule: "Username must be at least 5 characters long."},
                { rule: "Username must be composed of alphanumeric values only."}
            ]
        });
    }

    //Reject invalid emails
    if (!validEmail(req.body.email)){
        console.log("[INFO] Invalid Email");
        return res.render('signup',{
            message: "Invalid Email!",
            rules:[
                {rule: "Please use an valid email!"},
                {rule: "Email must have a valid domain"}
            ]
        });
    }

    // Reject weak passwords
    if (!validPassword(req.body.password)) {
        console.log("[INFO] Invalid Password");
        return res.render('signup',{
            message: "Invalid Password!",
            rules: [
                {rule: "Password must be at least 8 characters long"},
                {rule: "Password must contain at least one Lowercase letter"},
                {rule: "Password must contain at least one Uppercase letter"},
                {rule: "Password must contain at least one Number"}
            ]
        });
    }

    // Generate a hashed password
    var hashedPassword = new Promise(function(resolve, reject){
      var salt = bcrypt.genSaltSync(10);
      console.log("[INFO] Hash Passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        console.log("[INFO] Connecting to Database");
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
        data.client.query('SELECT * FROM users WHERE username=$1 or email=$2',
            [req.body.username,req.body.email],
            function(err, result) {
                if (err) {
                    console.log(err);
                    console.log("[INFO] Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length > 0) {
                    data.next();
                    console.log("[INFO] Released Client Back Into Pool");
                    console.log("[INFO] User with Username or Email Already Exists");
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
        console.log("[INFO] Querying Database");
        data[1].client.query('INSERT INTO users (username,email,password) VALUES($1,$2,$3)',[req.body.username, req.body.email, data[0]],
            function(err, result) {
                data[1].next();
                console.log("[INFO] Created New Account!");
                console.log("[INFO] Released Client Back Into Pool");
                var msg = 'Successful Signup, Please sign in to your account '.concat([req.body.username]);
                res.render('login',{message: msg});
            });
    },function(reason){
      console.log("[INFO] Unable to Create Account");
      res.render('signup',{message:reason})
    });

});

// Handle password change
router.post('/chpasswd',
  function(req, res, next) {

    // Reject weak passwords
    if (!validPassword(req.body.password) || !validPassword(req.body.passwordc)) {
        console.log("[INFO] Invalid Password");
        return res.render('chpasswd',{
            message: "Invalid Password!",
            rules: [
                {rule: "Password must be at least 8 characters long"},
                {rule: "Password must contain at least one Lowercase letter"},
                {rule: "Password must contain at least one Uppercase letter"},
                {rule: "Password must contain at least one Number"}
            ]
        });
    }
    if(req.body.password != req.body.passwordc){
        console.log("[INFO] Passwords don't Match!");
        return res.render('chpasswd',{
            message: "Passwords Don't Match!",
            rules: [
                {rule: "Passwords Must Match!"}
            ]
        });
    }

    // Generate a hashed password
    var hashedPassword = new Promise(function(resolve, reject){
      var salt = bcrypt.genSaltSync(10);
      console.log("[INFO] Hash Passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        console.log("[INFO] Connecting to Database");
        if (err) {
            reject(Error("Unable to connect to database"));
        }
        else {
            resolve({'client':client,'next':next});
        }
      });
  }).then(function(data) {
      // Check if Account exists
      return new Promise(function(resolve, reject) {
        console.log("[INFO] Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
            function(err, result) {
                if (err) {
                    console.log(err);
                    console.log("[INFO] Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length == 1){
                    console.log("[INFO] Username Found, Proceeding to change Password");
                    resolve(data);
                }
                else {
                    data.next();
                    console.log("[INFO] Released Client Back Into Pool");
                    console.log("[INFO] User with Username Does Not Exist");
                    reject(Error(" User with Username Does Not Exist, Unexpected Error"));
                }
            });
        });
    });
    Promise.all([hashedPassword, db]).then(function(data) {
        console.log("[INFO] Querying Database");
        data[1].client.query('UPDATE users SET password=$1 WHERE username=$2',[data[0],req.user.username],
            function(err, result) {
                data[1].next();
                console.log("[INFO] Updated Account Info");
                console.log("[INFO] Released Client Back Into Pool");
                msg = 'Password has been Successfully Changed. You must now log in.';
                req.logout();
                res.render('user',{message: msg, tasks:[]});
            });
    },function(reason){
      console.log("[INFO] Unable to Change Passwords");
      res.render('settings',{user : req.user,message:reason})
    });

});
// Handle email change
router.post('/chemail',
  function(req, res, next) {

     // Reject invalid email
    if (!validEmail(req.body.email) || !validEmail(req.body.emailc)) {
        console.log("[INFO] Invalid Email");
        return res.render('chpasswd',{
            message: "Invalid Email",
            rules: "Please use an valid email!"
        });
    }

    if(req.body.email != req.body.emailc){
        console.log("[INFO] Passwords don't Match!");
        return res.render('chemail',{
            message: "Emails Don't Match!",
            rules: [
                {rule: "Emails Must Match!"}
            ]
        });
    }
    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        console.log("[INFO] Connecting to Database");
        if (err) {
            reject(Error("Unable to connect to database"));
        }
        else {
            resolve({'client':client,'next':next});
        }
      });
  }).then(function(data) {
      // First check if account exists.
      return new Promise(function(resolve, reject) {
        console.log("[INFO] Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
            function(err, result) {
                if (err) {
                    console.log(err);
                    console.log("[INFO] Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length === 1){
                    console.log("[INFO] Username Found, Proceeding to change email");
                    resolve(data);
                }
                else {
                    data.next();
                    console.log("[INFO] Released Client Back Into Pool");
                    console.log("[INFO] User with Username Does Not Exist");
                    reject(Error(" User with Username Does Not Exist, Unexpected Error"));
                }
            });
        });
    });
    Promise.all([db]).then(function(data) {
        console.log("[INFO] Querying Database");
        data[0].client.query('UPDATE users SET email=$1 WHERE username=$2',[req.body.email,req.user.username],
            function(err, result) {
                data[0].next();
                console.log("[INFO] Updated Account Info");
                console.log("[INFO] Released Client Back Into Pool");
                var msg = 'Email has been Successfully Changed';
                fetchTasks(req,res,function(usertasks){
                    res.render('user',{user: req.user, message: msg, tasks: usertasks});
                });
            });
    },function(reason){
      console.log("[INFO] Unable to Change Email");
      res.render('settings',{message:reason})
    });
});

// Be careful with the data returned from this puppy
function fetchInfo(req, res, next){
    pg.connect(process.env.CONSTRING,function(err, client, done){
        console.log("[INFO] Connecting to Database");
        if (err){
            reject(Error("Unable to connect to database"));
        }
        else {
            client.query('SELECT * FROM users,notes WHERE users.username=$1 AND notes.username=$1',[req.user.username],
            function(err,result){
                if (err){
                    console.error("[INFO] Unable to Query DB");
                }
                else if (result.rows.length >= 0){
                    done();
                    console.log("[INFO] Released Client Back Into Pool");
                    console.log("[INFO] User Info Found");
                    next(result.rows);
                }
                else{
                    console.log("[INFO] Unexpected Error");
                }
            });
        }
    });
}
// Modifies an existing task in the Database
router.post('/modifytask',
    function(req, res, next){

        // Reject invalid task title
        if (!validTaskTitle(req.body.newtasktitle)) {
            console.log("[INFO] Invalid Task Title!");
            return res.redirect('/users');

        }
        //Reject invalid task body
        if (!validTaskBody(req.body.taskbody)){
            console.log("[INFO] Invalid Task Body!");
            return res.redirect('/users');
        }

        //Reject invalid task date and time
        if (!validDate(req.body.datedue) || !validTime(req.body.timedue)){
            console.log("[INFO] Invalid Date/Time!");
            return res.redirect('/users');
        }

        var db = new Promise(function(resolve,reject){
        console.log("[INFO] Connecting to Database");
        pg.connect(process.env.CONSTRING,function(err, client, next){
            if(err){
                reject(Error("Unable to Connect to DB"));
            }
            else{
                resolve({'client':client,'next':next});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                console.log("[INFO] Querying Database");
                data.client.query('SELECT * FROM notes WHERE title=$1 AND username=$2',[req.body.newtasktitle,req.user.username],
                function(err,result){
                    if (err){
                        console.log(err);
                        console.error("[INFO] Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 0){
                        console.log("[INFO] Task Found");
                        console.log("[INFO] Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        console.log("[INFO] Task Title Already Taken!");
                        reject(Error("Task with Title already exists!"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            console.log("[INFO] Updating Task Info");
            data[0].client.query('UPDATE notes SET title=$1, datedue=$2, timedue=$3, taskbody=$4 WHERE username=$5 AND title=$6',
            [req.body.newtasktitle, req.body.datedue, req.body.timedue, req.body.taskbody,req.user.username,req.body.oldtasktitle],
            function(err, result) {
                if(err){
                    console.log("[INFO] Unable To Insert Note into Database");
                    console.error(err);
                }
                data[0].next();
                console.log("[INFO] Updated Task!");
                console.log("[INFO] Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                        res.render('user',{ user:req.user, tasks:usertasks });
                });
            });
        },function(reason){
            console.log("[INFO] Unable to Modify Task");
            fetchTasks(req,res,function(usertasks){
                res.render('user',{ user: req.user,message:reason, tasks:usertasks });
            });
        });
});

module.exports = router;
