/**
* @Author: Vargas Hector <vargash1>
* @Date:   Monday, March 28th 2016, 3:29:51 pm
* @Email:  vargash1@wit.edu
* @Last modified by:   vargash1
* @Last modified time: Thursday, April 14th 2016, 9:03:48 pm
*/

var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var bcrypt = require('bcryptjs');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "vTask"});
var routes = require('./routes/index');
var users = require('./routes/users');
var pg = require('pg');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var app = express();
var session = require('express-session');


require('dotenv').config();
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
},
function(username,password,done){
    pg.connect(process.env.CONSTRING, function(err, client, next){
        if (err){
            log.debug({time: Date()}, err);
            log.fatal({time: Date()}, "Unable To Connect To Database");
        }
        log.info({time: Date()}, "Connected to Database");
        client.query('SELECT * FROM users WHERE username=$1', [username], function(err, result) {
            next();
            if (result.rows.length > 0){
                var matched = bcrypt.compareSync(password, result.rows[0].password);
                if (matched) {
                    log.info({time: Date()}, "Successful Login");
                    return done(null, result.rows[0]);
                }
            }
            log.warn({time: Date()}, "Invalid Username or Password");
            return done(null, false);
        })
    });
}));

// Store user information into session
passport.serializeUser(function(user, done) {
  return done(null, user.id);
});

// Get user information out of session
passport.deserializeUser(function(id, done) {
    log.info({time: Date()}, "Connecting to datbase");
    pg.connect(process.env.CONSTRING,function(err,client,next){
        client.query('SELECT id, username FROM users WHERE id = $1', [id], function(err, result) {
            log.info({time: Date()}, "Releasing client back into pool");
            next()
            // Return the user
            if (result) {
                log.info({time: Date()}, "User Found")
                return done(null, result.rows[0]);
            }
            return done(null, false);
        });
    });
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(favicon(path.join(__dirname, 'public','images','favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  proxy: true,
  secret: 'web example',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: app.get('env') === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/', routes);
app.use('/users', users);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
