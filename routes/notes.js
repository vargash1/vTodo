var express = require('express');
var router = express.Router();
var pg = require('pg');
var conString = "pg://vargash1:guest@localhost:5432/vtodo_db";
var dbclient = new pg.Client(conString);

/* GET home page. */
router.get('/', function(req, response, next) {
  dbclient.connect(function(err, client, done) {
    client.query('SELECT * FROM notes', function(err, result) {
      done();
      if (err) {
        response.json(err);
      } else {
        response.json(result.rows);
      }
    });
  });
});

module.exports = router;
