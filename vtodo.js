var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var bcrypt = require('bcryptjs');
var routes = require('./routes/index');
var users = require('./routes/users');
var notes = require('./routes/notes');
var pg = require('pg');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var app = express();
var session = require('express-session');
var conString = "pg://vargash1:guest@localhost:5432/vtodo_db";
var dbclient = new pg.Client(conString);

dbclient.connect();
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
},
function(username,password,done){
    console.log("[INFO] Connected to Database: psql");
    dbclient.query('SELECT * FROM users WHERE username = $1', [username], function(err, result) {
    if (err){
        console.log("[INFO] Database Query Error");
        return done(err);
    }
    if (result.rows.length > 0){
        var matched = bcrypt.compareSync(password, result.rows[0].password);
        if (matched) {
            console.log("[INFO] Successful Login");
            return done(null, result.rows[0]);
        }
    }
    console.log("[INFO] Invalid Username or Password");
    return done(null, false);
    });
}));

// Store user information into session
passport.serializeUser(function(user, done) {
  return done(null, user.id);
});

// Get user information out of session
passport.deserializeUser(function(id, done) {
      dbclient.query('SELECT id, username FROM users WHERE id = $1', [id], function(err, result) {
      // Return the user
      if (result) {
        return done(null, result.rows[0]);
      }
      return done(null, false);
    });
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
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
app.use('/notes', notes);


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
//
// dbclient.query("CREATE TABLE IF NOT EXISTS userstest(firstname varchar(64), lastname varchar(64))");
// dbclient.query("INSERT INTO userstest(firstname,lastname) values ($1, $2)", ['kek','top']);
// var query = dbclient.query("SELECT firstname, lastname FROM userstest ORDER BY lastname, firstname");
// query.on("row", function (row, result) {
//     result.addRow(row);
// });
// query.on("end", function (result) {
//     console.log(JSON.stringify(result.rows, null, "    "));
//     dbclient.end();
// });
