/**
* @Author: Vargas Hector <vargash1>
* @Date:   Wednesday, March 30th 2016, 5:34:31 pm
* @Email:  vargash1@wit.edu
* @Last modified by:   vargash1
* @Last modified time: Thursday, April 14th 2016, 6:10:08 pm
*/

var express = require('express');
var router = express.Router();
var passport = require('passport');
var pg = require('pg')
var bcrypt = require('bcryptjs');
var Promise = require('promise');
var moment = require('moment');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "vTask"})
require('dotenv').config();
moment().format();

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
        res.render('login');
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
        fetchColors(req,res,function(allcolors){
            res.render('addtask',{user: req.user, msg: "True", allcolors: allcolors});
        });
    });

router.get('/modifytask',
    loggedIn,
    function(req,res){
        fetchTasks(req,res,function(usertasks){
            res.render('user',{user: req.user, tasks:usertasks});
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
        log.info("Time Missing and will be set to Current Time");
        modtime = moment().format('HH:mm:ss');
        return modtime;
    }
    return ttime;
}

// generate tomorrow's date if date isnt passed
function validDate(tdate){
    var moddate = tdate.trim();
    if (moddate === ''){
        log.info("Date Missing and will be set to tomorrow's Date!");
        var tmmr = moment().add(1,'days');
        moddate = tmmr.format('YYYY-MM-DD')
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
    log.info("Connecting to Database");
    pg.connect(process.env.CONSTRING, function(err,client,done){
        if(err){
            log.error("Unable to Connect to Database");
        }
        log.info("Connected to Database");
        client.query('SELECT noteid,title,to_char(datedue, \'MM-DD-YYYY\'),timedue,taskbody,colors,txtcolor,bxshadow FROM notes WHERE username=$1 ORDER BY noteid DESC',[req.user.username],
        function(err,result){
            if (err){
                log.error(err);
                log.error("Unable to Query Database");
            }
            else if (result.rows.length > 0){
                done();
                log.info("User's Tasks Found");
                log.info("Released DB Client Back Into Pool");
                next(result.rows);
            }else{
                log.warn(" No Tasks Where Found!");
                next([]);
            }
        });
    });
}

// Fetches all availble colors in the database for note config
function fetchColors(req, res, next){
    log.info("Connecting to Database")
    pg.connect(process.env.CONSTRING, function(err, client, done){
        if (err){
            log.error(err)
            log.error("Unable to Connect to  Database")
        }
        log.info("Connected to Database");
        client.query('SELECT colorcode from colorchoices', function(err, result){
            if (err){
                log.error(err);
                log.error("Unable to Query Database")
            }
            else if (result.rows.length > 0){
                done();
                log.info("Returning Colors");
                log.info("Released DB Client Back Into Pool");
                next(result.rows);
            } else {
                log.fatal("No colors were found, this is an unexpected error");
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
            console.log(" Invalid Task Body!");
            return res.render('addtask',{
                user: req.user,
                msg: "True",
                message: "Invalid Task Body!",
                rules: [
                     {rule: "Task Body must contain at least 3 characters!"},
                     {rule: "Task Body cannot be empty!"}
                ]
            });
        }

        req.body.datedue = validDate(req.body.datedue);
        req.body.timedue = validTime(req.body.timedue);

        var db = new Promise(function(resolve,reject){
        console.log(" Connecting to Database");
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
                console.log(" Querying Database");
                data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
                function(err,result){
                    if (err){
                        console.log(err);
                        console.error(" Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        console.log(" Proceeding to add user task");
                        resolve(data);
                    }
                    else{
                        console.log("[WARN] User not Found!");
                        reject(Error("User does not exist, Unexpected error!"))
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            console.log(" Querying Database");
            data[0].client.query('INSERT INTO notes (username,title,datedue,timedue,taskbody) VALUES($1,$2,$3,$4,$5)',
            [req.user.username, req.body.tasktitle, req.body.datedue, req.body.timedue, req.body.taskbody],
            function(err, result) {
                if(err){
                    console.log(" Unable To Insert Note into Database");
                    console.error(err);
                }
                data[0].next();
                console.log(" Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                    res.render('user',{user:req.user,tasks:usertasks});
                });
            });
        },function(reason){
            console.log(" Unable to Create Task");
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
        console.log(" Invalid Username!");
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
        console.log(" Invalid Email");
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
        console.log(" Invalid Password");
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
      console.log(" Hash Passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        console.log(" Connecting to Database");
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
        console.log(" Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1 or email=$2',[req.body.username,req.body.email],
            function(err, result) {
                if (err) {
                    console.log(err);
                    console.log(" Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length > 0) {
                    data.next();
                    console.log(" Released Client Back Into Pool");
                    console.log(" User with Username or Email Already Exists");
                    reject(Error("Username or Email Already In Use!"));
                }
                else {
                    console.log(" Username and Email Available.");
                    resolve(data);
                }
            });
        });
    });
    Promise.all([hashedPassword, db]).then(function(data) {
        console.log(" Querying Database");
        data[1].client.query('INSERT INTO users (username,email,password) VALUES($1,$2,$3)',[req.body.username, req.body.email, data[0]],
            function(err, result) {
                data[1].next();
                console.log(" Created New Account!");
                console.log(" Released Client Back Into Pool");
                var msg = 'Successful Signup, Please sign in to your account '.concat([req.body.username]);
                res.render('login',{message: msg});
            });
    },function(reason){
      console.log(" Unable to Create Account");
      res.render('signup',{message:reason})
    });

});

// Handle password change
router.post('/chpasswd',
  function(req, res, next) {

    // Reject weak passwords
    if (!validPassword(req.body.password) || !validPassword(req.body.passwordc)) {
        console.log(" Invalid Password");
        return res.render('chpasswd',{
            user:req.user,
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
        console.log(" Passwords don't Match!");
        return res.render('chpasswd',{
            user:req.user,
            message: "Passwords Don't Match!",
            rules: [
                {rule: "Passwords Must Match!"}
            ]
        });
    }

    // Generate a hashed password
    var hashedPassword = new Promise(function(resolve, reject){
      var salt = bcrypt.genSaltSync(10);
      console.log(" Hash Passwords");
      resolve(bcrypt.hashSync(req.body.password, salt));
    });

    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        console.log(" Connecting to Database");
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
        console.log(" Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
            function(err, result) {
                if (err) {
                    console.log(err);
                    console.log(" Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length == 1){
                    console.log(" Username Found, Proceeding to change Password");
                    resolve(data);
                }
                else {
                    data.next();
                    console.log(" Released Client Back Into Pool");
                    console.log(" User with Username Does Not Exist");
                    reject(Error(" User with Username Does Not Exist, Unexpected Error"));
                }
            });
        });
    });
    Promise.all([hashedPassword, db]).then(function(data) {
        console.log(" Querying Database");
        data[1].client.query('UPDATE users SET password=$1 WHERE username=$2',[data[0],req.user.username],
            function(err, result) {
                data[1].next();
                console.log(" Updated Account Info");
                console.log(" Released Client Back Into Pool");
                msg = 'Password has been Successfully Changed. You must now log in.';
                req.logout();
                res.render('user',{message: msg, tasks:[]});
            });
    },function(reason){
      console.log(" Unable to Change Passwords");
      res.render('settings',{user : req.user,message:reason})
    });

});
// Handle email change
router.post('/chemail',
  function(req, res, next) {

     // Reject invalid email
    if (!validEmail(req.body.email) || !validEmail(req.body.emailc)) {
        console.log(" Invalid Email");
        return res.render('chpasswd',{
            user:req.user,
            message: "Invalid Email",
            rules:[
                {rule: "Please use an valid email!"}
            ]
        });
    }

    if(req.body.email != req.body.emailc){
        console.log(" Passwords don't Match!");
        return res.render('chemail',{
            user:req.user,
            message: "Emails Don't Match!",
            rules: [
                {rule: "Emails Must Match!"}
            ]
        });
    }
    // Connect to database
    var db = new Promise(function(resolve, reject) {
    pg.connect(process.env.CONSTRING,function(err, client, next) {
        console.log(" Connecting to Database");
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
        console.log(" Querying DB for Username Availability");
        data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
            function(err, result) {
                if (err) {
                    console.log(err);
                    console.log(" Unable to Query DB");
                    reject(Error("Unable to query database"));
                }
                else if (result.rows.length === 1){
                    console.log(" Username Found, Proceeding to change email");
                    resolve(data);
                }
                else {
                    data.next();
                    console.log(" Released Client Back Into Pool");
                    console.log(" User with Username Does Not Exist");
                    reject(Error(" User with Username Does Not Exist, Unexpected Error"));
                }
            });
        });
    });
    Promise.all([db]).then(function(data) {
        console.log(" Querying Database");
        data[0].client.query('UPDATE users SET email=$1 WHERE username=$2',[req.body.email,req.user.username],
            function(err, result) {
                data[0].next();
                console.log(" Updated Account Info");
                console.log(" Released Client Back Into Pool");
                var msg = 'Email has been Successfully Changed';
                fetchTasks(req,res,function(usertasks){
                    res.render('user',{user: req.user, message: msg, tasks: usertasks});
                });
            });
    },function(reason){
      console.log(" Unable to Change Email");
      res.render('settings',{message:reason})
    });
});

// Be careful with the data returned from this puppy
function fetchInfo(req, res, next){
    pg.connect(process.env.CONSTRING,function(err, client, done){
        console.log(" Connecting to Database");
        if (err){
            reject(Error("Unable to connect to database"));
        }
        else {
            client.query('SELECT * FROM users,notes WHERE users.username=$1 AND notes.username=$1',[req.user.username],
            function(err,result){
                if (err){
                    console.error(" Unable to Query DB");
                }
                else if (result.rows.length >= 0){
                    done();
                    console.log(" Released Client Back Into Pool");
                    console.log(" User Info Found");
                    next(result.rows);
                }
                else{
                    console.log(" Unexpected Error");
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
            console.log(" Invalid Task Body!");
            return res.redirect('/users');
        }

        req.body.datedue = validDate(req.body.datedue);
        req.body.timedue = validTime(req.body.timedue);

        var db = new Promise(function(resolve,reject){
        console.log(" Connecting to Database");
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
                console.log(" Querying Database");
                data.client.query('SELECT * FROM users WHERE username=$1',[req.user.username],
                function(err,result){
                    if (err){
                        console.log(err);
                        console.error(" Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        console.log(" User Found");
                        console.log(" Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        console.log("[WARN] User not Found!!");
                        reject(Error("User does not exist, Unexpected error!"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            console.log(" Updating Task Info");
            data[0].client.query('UPDATE notes SET title=$1, datedue=$2, timedue=$3, taskbody=$4 WHERE username=$5 AND noteid=$6',
            [req.body.tasktitle, req.body.datedue, req.body.timedue, req.body.taskbody,req.user.username,req.body.dbid],
            function(err, result) {
                if(err){
                    console.log(" Unable To Insert Note into Database");
                    console.error(err);
                }
                data[0].next();
                console.log(" Updated Task!");
                console.log(" Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                        res.render('user',{ user:req.user, tasks:usertasks });
                });
            });
        },function(reason){
            console.log(" Unable to Modify Task");
            fetchTasks(req,res,function(usertasks){
                res.render('user',{ user: req.user, tasks:usertasks });
            });
        });
});
// Deletes an existing task in the Database
router.post('/deletetask',
    function(req, res, next){

        var db = new Promise(function(resolve,reject){
        console.log(" Connecting to Database");
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
                console.log(" Querying Database");
                data.client.query('SELECT * FROM notes WHERE noteid=$1 AND username=$2',[req.body.dbid,req.user.username],
                function(err,result){
                    if (err){
                        console.log(err);
                        console.error(" Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        console.log(" Task Found");
                        console.log(" Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        console.log(" Task Title Does Not Exist");
                        reject(Error("Unexpected Error: Task Title Does Not Exist"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            console.log(" Updating Task Info");
            data[0].client.query('DELETE FROM notes WHERE noteid=$1 AND username=$2',
            [req.body.dbid,req.user.username],
            function(err, result) {
                if(err){
                    console.log(" Unable To Delete Note from Database");
                    console.error(err);
                }
                data[0].next();
                console.log(" Deleted Task!");
                console.log(" Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                        res.render('user',{ user:req.user, tasks:usertasks });
                });
            });
        },function(reason){
            console.log(" Unable to Delete Task!");
            fetchTasks(req,res,function(usertasks){
                res.render('user',{ user: req.user, tasks:usertasks });
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

// Deletes an existing task in the Database
router.post('/changecolor',
    function(req, res, next){
        req.body.txtclid = setTextColor(req.body.color);
        req.body.bxid = setBoxShadow(req.body.color);

        var db = new Promise(function(resolve,reject){
        console.log(" Connecting to Database");
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
                console.log(" Querying Database");
                data.client.query('SELECT * FROM notes WHERE noteid=$1 AND username=$2',[req.body.dbid,req.user.username],
                function(err,result){
                    if (err){
                        console.log(err);
                        console.error(" Unable to Query DB");
                        reject(Error("Unable to Query DB"));
                    }
                    else if (result.rows.length === 1){
                        console.log(" Task Found");
                        console.log(" Released Client Back Into Pool");
                        resolve(data);
                    }
                    else{
                        console.log(" Task Title Does Not Exist");
                        reject(Error("Unexpected Error: Task Title Does Not Exist"));
                        data.next();
                    }
                });
            });
        });
        Promise.all([db]).then(function(data) {
            console.log(" Updating Task Info");
            data[0].client.query('UPDATE notes SET colors=$1,txtcolor=$2,bxshadow=$3 WHERE noteid=$4 AND username=$5',
            [req.body.color,req.body.txtclid,req.body.bxid,req.body.dbid,req.user.username],
            function(err, result) {
                if(err){
                    console.log(" Unable To Delete Note from Database");
                    console.error(err);
                }
                data[0].next();
                console.log(" Changed Task Color");
                console.log(" Released Client Back Into Pool");
                fetchTasks(req,res,function(usertasks){
                        res.render('user',{ user:req.user, tasks:usertasks });
                });
            });
        },function(reason){
            console.log(" Unable to Delete Task!");
            fetchTasks(req,res,function(usertasks){
                res.render('user',{ user: req.user, tasks:usertasks });
            });
        });
});

module.exports = router;
