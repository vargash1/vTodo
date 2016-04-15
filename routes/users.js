/**
* @Author: Vargas Hector <vargash1>
* @Date:   Wednesday, March 30th 2016, 5:34:31 pm
* @Email:  vargash1@wit.edu
* @Last modified by:   vargash1
* @Last modified time: Thursday, April 14th 2016, 10:59:45 pm
*/

var express = require('express');
var router = express.Router();
var passport = require('passport');
var pg = require('pg')
var bcrypt = require('bcryptjs');
var Promise = require('promise');
var moment = require('moment');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "vTask"});
require('dotenv').config();
moment().format();

/* GET users listing. */
router.get('/',
    function(req, res, next) {
        if (req.user){
            fetchTasks(req,res,function(usertasks) {
                fetchColors(req, res, function(allcolors){
                    res.render('user',{user: req.user,tasks:usertasks,allcolors:allcolors});
                });
            });
        } else {
            res.render('user',{user: req.user, tasks:[]});
        }
    });

router.get('/settings',
    loggedIn,
    function(req,res,next){
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
              fetchColors(req, res, function(allcolors){
                  res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
              });
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
        res.render('login');
    }
 }

router.get('/signup',
  function(req, res) {
    // If logged in, go to profile page
    if(req.user) {
        fetchTasks(req,res,function(usertasks){
            fetchColors(req,res,function(allcolors){
                res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});s
            });
        });
    }
    res.render('signup',{user: req.user});
  });

router.get('/addtask',
    loggedIn,
    function(req, res){
        fetchColors(req,res,function(allcolors){
            res.render('addtask',{user: req.user, msg: "True", allcolors: allcolors});
        });
    });

router.get('/modifytask',
    loggedIn,
    function(req,res){
        fetchTasks(req,res,function(usertasks){
            fetchColors(req,res,function(allcolors){
                res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
            });
        });
    });

// what is the point of having an empty task?
function validTaskBody(tbody){
    var modbody = tbody.trim();
    return modbody !== '' && modbody.length >= 3;
}

// generate current time if time isnt passed
function validTime(ttime){
    var modtime = ttime.trim();
    if (modtime === ''){
        log.info({time: Date()}, "Time Missing and will be set to Current Time");
        modtime = moment().format('HH:mm:ss');
        return modtime;
    }
    return ttime;
}

// generate tomorrow's date if date isnt passed
function validDate(tdate){
    var moddate = tdate.trim();
    if (moddate === ''){
        log.info({time: Date()}, "Date Missing and will be set to tomorrow's Date!");
        var tmmr = moment().add(1,'days');
        moddate = tmmr.format('YYYY-MM-DD');
        return moddate;
    }
    return tdate;
}

// Utility function
function typeOf (obj) {
  return {}.toString.call(obj).split(' ')[1].slice(0, -1).toLowerCase();
}

// Fetches all tasks in database that belong to the user
function fetchTasks(req, res, next){
    log.info({time: Date()}, "Connecting to Database");
    pg.connect(process.env.CONSTRING, function(err,client,done){
        if(err){
            log.debug({time: Date()},err);
            log.fatal({time: Date()}, "Unable to Connect to Database");
        }
        log.info({time: Date()}, "Connected to Database");
        client.query('SELECT noteid,title,to_char(datedue, \'MM-DD-YYYY\'),timedue,taskbody,colors,txtcolor,bxshadow FROM notes WHERE username=$1 ORDER BY noteid DESC',[req.user.username],
        function(err,result){
            if (err){
                log.debug({time: Date()},err);
                log.fatal({time: Date()}, "Unable to Query Database");
            }
            else if (result.rows.length > 0){
                done();
                log.info({time: Date()}, "User's Tasks Found");
                log.info({time: Date()}, "Released DB Client Back Into Pool");
                next(result.rows);
            }else{
                log.warn({time: Date()}, "No Tasks Where Found!");
                next([]);
            }
        });
    });
}

// Fetches all availble colors in the database for note config
function fetchColors(req, res, next){
    log.info({time: Date()},"Connecting to Database")
    pg.connect(process.env.CONSTRING, function(err, client, done){
        if (err){
            log.debug({time: Date()}, err);
            log.fatal({time: Date()}, "Unable to Connect to  Database");
        }
        log.info({time: Date()}, "Connected to Database");
        client.query('SELECT colorcode from colorchoices', function(err, result){
            if (err){
                log.debug({time: Date()}, err);
                log.fatal({time: Date()}, "Unable to Query Database");
            }
            else if (result.rows.length > 0){
                done();
                log.info({time: Date()}, "Returning Colors");
                log.info({time: Date()}, "Released DB Client Back Into Pool");
                next(result.rows);
            } else {
                log.fatal({time: Date()}, "No colors were found, this is an unexpected error");
                next([]);
            }
        });
    });
}

// Adds a task to the Database
router.post('/addtask',
    function(req, res, next){

        //Reject invalid task body
        if (!validTaskBody(req.body.taskbody)){
            log.warn({time: Date()}, "Invalid Task Body!");
            fetchColors(req, res, function(allcolors){
                return res.render('addtask',{
                    user: req.user,
                    msg: "True",
                    message: "Invalid Task Body!",
                    allcolors: allcolors,
                    rules: [
                         {rule: "Task Body must contain at least 3 characters!"},
                         {rule: "Task Body cannot be empty!"}
                    ]
                });
            });
            return;
        }

        req.body.datedue = validDate(req.body.datedue);
        req.body.timedue = validTime(req.body.timedue);
        req.body.txtclid = setTextColor(req.body.color);
        req.body.bxid = setBoxShadow(req.body.color);

        var db = new Promise(function(resolve,reject){
        log.info({time: Date()}, "Connecting to Database");
        pg.connect(process.env.CONSTRING,function(err, client, next){
            if(err){
                log.debug({time: Date()},err);
                log.fatal({time: Date()}, "Unable to Connect to DB");
                reject(Error("Unable to Connect to DB"));
            }
            else{
                resolve({'client':client,'next':next});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                log.info({time: Date()}, "Querying Database");
                data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
                function(err,result){
                    if (err){
                        log.debug({time: Date()}, err);
                        log.fatal({time: Date()}, "Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        log.info({time: Date()}, "Proceeding to add user task");
                        resolve(data);
                    }
                    else{
                        log.fatal({time: Date()}, "User not Found, Unexpected error!");
                        reject(Error("User does not exist, Unexpected error!"));
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            log.info({time: Date()}, "Querying Database");
            data[0].client.query('INSERT INTO notes (username,title,datedue,timedue,taskbody,colors,txtcolor,bxshadow) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [req.user.username, req.body.tasktitle, req.body.datedue, req.body.timedue, req.body.taskbody, req.body.color, req.body.txtclid ,req.body.bxid],
            function(err, result) {
                if(err){
                    log.debug({time: Date()},{err:err});
                    log.fatal({time: Date()}, "Unable To Insert Note into Database");
                }
                data[0].next();
                log.info({time: Date()}, "Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                    fetchColors(req,res,function(allcolors){
                        res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                    });
                });
            });
        },function(reason){
            log.error({time: Date()}, "Unable to Create Task");
            log.debug({time: Date()},reason);
            fetchTasks(req,res,function(usertasks){
                fetchColors(req,res,function(allcolors){
                    res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                });
            });
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
        log.warn({time: Date()}, "Invalid Username!");
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
        log.warn({time: Date()}, "Invalid Email");
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
        log.warn({time: Date()}, "Invalid Password");
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
      log.debug({time: Date()}, "Hashing Password");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        log.info({time: Date()}, " Connecting to Database");
        if (err) {
            log.fatal({time: Date()}, "Unable to connect to database");
            log.debug({time: Date()},err);
            reject(Error("Unable to connect to database"));
        }
        else {
            resolve({'client':client,'next':next});
        }
      });
  }).then(function(data) {
      // Check if they're already a user
      return new Promise(function(resolve, reject) {
        log.debug({time: Date()}, "Checking for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1 or email=$2',[req.body.username,req.body.email],
            function(err, result) {
                if (err) {
                    log.debug({time: Date()}, err);
                    log.fatal({time: Date()}, "Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length > 0) {
                    data.next();
                    log.info({time: Date()}, "Released Client Back Into Pool");
                    log.warn({time: Date()}, "User with Username or Email Already Exists");
                    reject(Error("Username or Email Already In Use!"));
                }
                else {
                    log.info({time: Date()}, "Username and Email Available.");
                    resolve(data);
                }
            });
        });
    });
    Promise.all([hashedPassword, db]).then(function(data) {
        log.info({time: Date()}, "Querying Database");
        data[1].client.query('INSERT INTO users (username,email,password) VALUES($1,$2,$3)',[req.body.username, req.body.email, data[0]],
            function(err, result) {
                data[1].next();
                log.info({time: Date()}, "Created New Account!");
                log.info({time: Date()}, "Released Client Back Into Pool");
                var msg = 'Successful Signup, Please sign in to your account '.concat([req.body.username]);
                res.render('login',{message: msg});
            });
    },function(reason){
      log.warn({time: Date()}, "Unable to Create Account");
      log.debug({time: Date()}, reason);
      res.render('signup',{message:reason});
    });

});

// Handle password change
router.post('/chpasswd',
    function(req, res, next){
        if (!validPassword(req.body.password) || !validPassword(req.body.passwordc)) {
            log.warn({time: Date()},"Invalid password");
            return res.render('chpasswd',{
                user:req.user,
                msg: "True",
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
        log.warn({time: Date()}, "Passwords don't Match!");
        return res.render('chpasswd',{
            user:req.user,
            msg: "True",
            message: "Passwords Don't Match!",
            rules: [
                {rule: "Passwords Must Match!"}
            ]
        });
    }

    // Generate a hashed password
    var hashedPassword = new Promise(function(resolve, reject){
      var salt = bcrypt.genSaltSync(10);
      log.debug({time: Date()}, " Hashing Passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        log.info({time: Date()}, "Connecting to Database");
        if (err) {
            log.debug({time: Date()},err);
            log.fatal({time: Date()}, "Unable to connect to database");
            reject(Error("Unable to connect to database"));
        }
        else {
            resolve({'client':client,'next':next});
        }
      });
  }).then(function(data) {
      // Check if Account exists
      return new Promise(function(resolve, reject) {
        log.debug({time: Date()}, "Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
            function(err, result) {
                if (err) {
                    log.debug({time: Date()}, err);
                    log.fatal({time: Date()}, "Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length == 1){
                    log.info({time: Date()}, "Username Found, Proceeding to change Password");
                    resolve(data);
                }
                else {
                    data.next();
                    log.debug({time: Date()}, "Released Client Back Into Pool");
                    log.warn({time: Date()}, "User with Username Does Not Exist");
                    reject(Error(" User with Username Does Not Exist, Unexpected Error"));
                }
            });
        });
    });
    Promise.all([hashedPassword, db]).then(function(data) {
        log.info({time: Date()}, "Querying Database");
        data[1].client.query('UPDATE users SET password=$1 WHERE username=$2',[data[0],req.user.username],
            function(err, result) {
                data[1].next();
                log.info({time: Date()}, "Updated Account Info");
                log.info({time: Date()}, "Released Client Back Into Pool");
                msg = 'Password has been Successfully Changed. You must now log in.';
                req.logout();
                res.render('user',{message: msg, tasks:[]});
            });
    },function(reason){
      log.error({time: Date()}, "Unable to Change Passwords");
      log.debug({time: Date()},reason);

      res.render('settings',{user : req.user,msg: "True",message:reason});
    });

});
// Handle email change
router.post('/chemail',
  function(req, res, next) {

     // Reject invalid email
    if (!validEmail(req.body.email) || !validEmail(req.body.emailc)) {
        log.warn({time: Date()}, "Invalid Email");
        return res.render('chemail',{
            user:req.user,
            msg: "True",
            message: "Invalid Email",
            rules:[
                {rule: "Please use an valid email!"}
            ]
        });
    }

    if(req.body.email != req.body.emailc){
        log.warn({time: Date()}, "Passwords don't Match!");
        return res.render('chemail',{
            user:req.user,
            msg: "True",
            message: "Emails Don't Match!",
            rules: [
                {rule: "Emails Must Match!"}
            ]
        });
    }
    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        log.info({time: Date()}, " Connecting to Database");
        if (err) {
            log.debug({time: Date()}, err);
            log.fatal("Unable to connect to database");
            reject(Error("Unable to connect to database"));
        }
        else {
            resolve({'client':client,'next':next});
        }
      });
  }).then(function(data) {
      // First check if account exists.
      return new Promise(function(resolve, reject) {
        log.info({time: Date()}, "Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
            function(err, result) {
                if (err) {
                    log.debug(err);
                    log.fatal({time: Date()}, "Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length === 1){
                    log.info({time: Date()}, "Username Found, Proceeding to change email");
                    resolve(data);
                }
                else {
                    data.next();
                    log.info({time: Date()}, "Released Client Back Into Pool");
                    log.fatal({time: Date()}, "User with Username Does Not Exist");
                    reject(Error(" User with Username Does Not Exist, Unexpected Error"));
                }
            });
        });
    });
    Promise.all([db]).then(function(data) {
        log.info({time: Date()}, "Querying Database");
        data[0].client.query('UPDATE users SET email=$1 WHERE username=$2',[req.body.email,req.user.username],
            function(err, result) {
                data[0].next();
                log.info({time: Date()}, "Updated Account Info");
                log.info({time: Date()}, "Released Client Back Into Pool");
                var msg = 'Email has been Successfully Changed';
                fetchTasks(req,res,function(usertasks){
                    fetchColors(req,res,function(allcolors){
                        res.render('user',{user: req.user, message: msg, tasks:usertasks, allcolors:allcolors});
                    });
                });
            });
    },function(reason){
      log.error({time: Date()}, "Unable to Change Email");
      log.debug({time: Date()}, reason);
      res.render('settings',{message:reason,msg: "True"});
    });
});

// Be careful with the data returned from this puppy
function fetchInfo(req, res, next){
    pg.connect(process.env.CONSTRING,function(err, client, done){
        log.info({time: Date()}, "Connecting to Database");
        if (err){
            log.debug({time: Date()}, err);
            log.fatal({time: Date()}, "Unable to connect to database");
            reject(Error("Unable to connect to database"));
        }
        else {
            client.query('SELECT * FROM users,notes WHERE users.username=$1 AND notes.username=$1',[req.user.username],
            function(err,result){
                if (err){
                    log.debug({time: Date()}, err);
                    log.fatal({time: Date()}, "Unable to Query DB");
                }
                else if (result.rows.length >= 0){
                    done();
                    log.info({time: Date()}, "Released Client Back Into Pool");
                    log.info({time: Date()}, "User Info Found");
                    next(result.rows);
                }
                else{
                    log.fatal({time: Date()}, "Unexpected Error when fetching user information");
                }
            });
        }
    });
}

// Modifies an existing task in the Database
router.post('/modifytask',
    function(req, res, next){

        //Reject invalid task body
        if (!validTaskBody(req.body.taskbody)){
            log.warn({time: Date()}, "Invalid Task Body!");
            return res.redirect('/users');
        }

        req.body.datedue = validDate(req.body.datedue);
        req.body.timedue = validTime(req.body.timedue);

        var db = new Promise(function(resolve,reject){
        log.info({time: Date()}, "Connecting to Database");
        pg.connect(process.env.CONSTRING,function(err, client, next){
            if(err){
                log.debug({time: Date()}, err)
                log.fatal({time: Date()}, "Unable to connect to database")
                reject(Error("Unable to Connect to DB"));
            }
            else{
                resolve({'client':client,'next':next});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                log.info({time: Date()}, "Querying Database");
                data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
                function(err,result){
                    if (err){
                        log.debug({time: Date()}, err);
                        log.fatal({time: Date()}, "Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        log.info({time: Date()}, "User Found");
                        log.info({time: Date()}, "Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        log.fatal({time: Date()}, "User not Found, unexpected error. How did you get here?");
                        reject(Error("User does not exist, Unexpected error!"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            log.info({time: Date()}, " Updating Task Info");
            data[0].client.query('UPDATE notes SET title=$1, datedue=$2, timedue=$3, taskbody=$4 WHERE username=$5 AND noteid=$6',
            [req.body.tasktitle, req.body.datedue, req.body.timedue, req.body.taskbody,req.user.username,req.body.dbid],
            function(err, result) {
                if(err){
                    log.fatal({time: Date()}, "Unable To Insert Note into Database");
                    log.debug({time: Date()}, err);
                }
                data[0].next();
                log.info({time: Date()}, "Updated Task!");
                log.info({time: Date()}, "Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                    fetchColors(req,res,function(allcolors){
                        res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                    });
                });
            });
        },function(reason){
            log.error({time: Date()}, "Unable to Modify Task");
            log.debug({time: Date()}, reason);
            fetchTasks(req,res,function(usertasks){
                fetchColors(req,res,function(allcolors){
                    res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                });
            });
        });
});
// Deletes an existing task in the Database
router.post('/deletetask',
    function(req, res, next){

        var db = new Promise(function(resolve,reject){
        log.info({time: Date()}, "Connecting to Database");
        pg.connect(process.env.CONSTRING,function(err, client, next){
            if(err){
                log.fatal({time: Date()}, "Unable to connect to database");
                log.debug({time: Date()}, err);
                reject(Error("Unable to Connect to DB"));
            }
            else{
                resolve({'client':client,'next':next});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                log.info({time: Date()}, "Querying Database");
                data.client.query('SELECT * FROM notes WHERE noteid=$1 AND username=$2',[req.body.dbid,req.user.username],
                function(err,result){
                    if (err){
                        log.debug({time: Date()}, err);
                        log.fatal({time: Date()}, "Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        log.info({time: Date()}, "Task Found");
                        log.info({time: Date()}, "Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        log.fatal("Task Title Does Not Exist. This is unexpected. How did you get here?");
                        reject(Error("Unexpected Error: Task Title Does Not Exist"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            log.info({time: Date()}, "Updating Task Info");
            data[0].client.query('DELETE FROM notes WHERE noteid=$1 AND username=$2',
            [req.body.dbid,req.user.username],
            function(err, result) {
                if(err){
                    log.fatal({time: Date()}, "Unable To Delete Note from Database");
                    log.debug({time: Date()}, err);
                }
                data[0].next();
                log.info({time: Date()}, "Deleted Task!");
                log.info({time: Date()}, "Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                    fetchColors(req,res,function(allcolors){
                        res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                    });
                });
            });
        },function(reason){
            log.error({time: Date()}, "Unable to Delete Task!");
            log.debug({time: Date()}, reason);
            fetchTasks(req,res,function(usertasks){
                fetchColors(req,res,function(allcolors){
                    res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                });
            });
        });
});

// Poor mans text color setting when text is too dark
function setTextColor(ncolor){
    if (ncolor == "#000080" || ncolor == "black" || ncolor == "#2F4F4F" || ncolor == "#0F37A9"){
        return "white";
    }
    return "black"
}

// Poor mans box shadow when text is too dark
function setBoxShadow(ncolor){
    if (ncolor == "#000080" || ncolor == "black" || ncolor == "#2F4F4F" || ncolor == "#0F37A9"){
        return "0 4px 8px 0 rgba(255,255,255,0.24), 0 4px 8px 0  rgba(255,255,255,0.19)";
    }
    return "0 4px 8px 0 rgba(0,0,0,0.24),0 4px 8px 0 rgba(0,0,0,0.19)";
}

// changes an existing task color in the Database
router.post('/changecolor',
    function(req, res, next){
        req.body.txtclid = setTextColor(req.body.color);
        req.body.bxid = setBoxShadow(req.body.color);

        var db = new Promise(function(resolve,reject){
        log.info({time: Date()}, "Connecting to Database");
        pg.connect(process.env.CONSTRING,function(err, client, next){
            if(err){
                log.fatal({time: Date()}, "Unable to connect to database");
                log.debug({time: Date()}, err);
                reject(Error("Unable to Connect to DB"));
            }
            else{
                resolve({'client':client,'next':next});
            }
        });
        }).then(function(data) {
            return new Promise(function(resolve,reject){
                log.info({time: Date()},"Querying Database");
                data.client.query('SELECT * FROM notes WHERE noteid=$1 AND username=$2',[req.body.dbid,req.user.username],
                function(err,result){
                    if (err){
                        log.debug({time: Date()},err);
                        log.fatal({time: Date()},"Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        log.info({time: Date()},"Task Found");
                        log.info({time: Date()},"Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        log.fatal({time: Date()},"Task Title Does Not Exist. Unexpected error");
                        reject(Error("Unexpected Error: Task Title Does Not Exist"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            log.info({time: Date()},"Updating Task Info");
            data[0].client.query('UPDATE notes SET colors=$1,txtcolor=$2,bxshadow=$3 WHERE noteid=$4 AND username=$5',
            [req.body.color,req.body.txtclid,req.body.bxid,req.body.dbid,req.user.username],
            function(err, result) {
                if(err){
                    log.fatal({time: Date()},"Unable To Delete Note from Database");
                    log.debug({time: Date()},err);
                }
                data[0].next();
                log.info({time: Date()},"Changed Task Color");
                log.info({time: Date()},"Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                    fetchColors(req,res,function(allcolors){
                        res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                    });
                });
            });
        },function(reason){
            log.error({time: Date()},"Unable to update task color. Unexpected error");
            log.debug({time: Date()},reason);
            fetchTasks(req,res,function(usertasks){
                fetchColors(req,res,function(allcolors){
                    res.render('user',{user: req.user, tasks:usertasks, allcolors:allcolors});
                });
            });
        });
});

module.exports = router;
