(function() {
  var pg = require('pg');
  var pgClient = new pg.Client(process.env.DATABASE_URL);
  pgClient.connect(function(err) {
  if(err) {
    return console.error('could not connect to postgres', err);
  }
});

  var doQuery = function (sql, data) {
    var query = pgClient.query(sql, data);
    var affected_rows = [];

    query.on('row', function (row) {
        affected_rows.push(row);
    });

    query.on('end', function (result) {
        if (func) {
            func(res, affected_rows, data);
        }
        else if (affected_rows.length > 0) {
            res.writeHead(200, {'Content-Type':'text/plain'});
            if (affected_rows.length == 1)
                res.write(JSON.stringify(affected_rows[0]));
            else
                res.write(JSON.stringify(affected_rows));
            res.end();
        } else {
            res.end();
        }
    });

    query.on('error', function (error) {
        if (err) {
            err(error, res);
            func = false;
        } else {
            res.writeHead(200, {'Content-Type':'text/plain'});
            res.write(error + "\n \t from: " + query.text + '\n');
            res.end();
        }
    });
  }

  var updateLikeFood = function (like, userID, foodID) {
    doQuery("UPDATE Like SET Liked = $1 WHERE UID = $2 AND FID = $3;", [like, userID, foodID]);
  }

  var getLikes = function (userID) {
    //TODO: Just get names, or images, or what?
  }

  var getFoods = function (userID, location, price, distance) {
      // TODO: Get a list of restaurant IDs that deliver to location within distance
              // TODO: ordr.in
      // TODO: Get a list of all foods from those restaurants within price range
      // TODO: Get 4 random foods from that list
  }

  var setEndpoints = function (server) {
    server.post('/api/like', function(req, res) {
        updateLikeFood(true, req.param("user"), req.param("foodID"));
    });
    server.post('/api/dislike', function(req, res) {
        updateLikeFood(false, req.param("user"), req.param("foodID"));
    });
    server.get('/food', function(req, res) {
        getFoods(req.param("user"), req.param("location"), req.param("query"),
                req.param("distance"));
    });
  }

  module.exports.setEndpoints = setEndpoints;
}());
