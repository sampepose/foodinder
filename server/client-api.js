(function() {
  var ordrin = require("ordrin-api");
  // Initialize with your application secret key
  var ordrin_api = new  ordrin.APIs("44qby0ZpVX7xyc-bBbzrtKuVT9bvHAZ7yjbl2Mf2McE");

  var Q = require("q");

  var pg = require('pg');
  var pgClient = new pg.Client("postgres://tester:password@localhost/postgres");
  pgClient.connect(function(err) {
    if(err) {
      return console.error('could not connect to postgres', err);
    }
  });


  var res = null;

  var degreesToRadians = function(theta) {
    return theta * Math.PI / 180;
  }

  // haversine formula
  var distanceBetweenLatLong = function (long1, lat1, long2, lat2) {
    var EARTH_RAD = 3963; // miles
    var lat1Rads = degreesToRadians(lat1);
    var lat2Rads = degreesToRadians(lat2);
    var deltaLat = degreesToRadians(lat2 - lat1);
    var deltaLon = degreesToRadians(long2 - long1);

    var a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
    Math.cos(lat1Rads) * Math.cos(lat2Rads) * Math.sin(deltaLon/2) * Math.sin(deltaLon/2);

    return 2 * EARTH_RAD * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  var filterRestaurants = function (restaurants, curLat, curLong, dist) {
    var f = function (r) {
      var d = distanceBetweenLatLong(curLat, curLong, r.latitude, r.longitude);
      if (d > dist) {
        return false;
      }
      return true;
    }

    return restaurants.filter(f);
  }

  var doQuery = function (sql, data, cb) {
    var query = pgClient.query(sql, data);
    var affected_rows = [];

    query.on('row', function (row) {
      affected_rows.push(row);
    });

    query.on('end', function (result) {
      if (cb) {
        cb(res, affected_rows, data);
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

          //           res.writeHead(200, {'Content-Type':'text/plain'});
          res.write(error + "\n \t from: " + query.text + '\n');
          res.end();
        });
      }

      var updateLikeFood = function (res, like, userID, foodID) {
        doQuery("UPDATE Like SET Liked = $1 WHERE UID = $2 AND FID = $3;", [like, userID, foodID]);
      }

      var getLikes = function (res, userID) {
        //TODO: Just get names, or images, or what?
      }



      var isRestaurantInDB = function(rid, name, lat, long) {
        var deferred = Q.defer();
        doQuery("SELECT Name FROM Food WHERE RID = $1;", [rid], function (res, results) {
          if (results.length == 0)
            deferred.reject({rid: rid, name: name, lat: lat, long: long});
            else
              deferred.resolve(results);
            });
            return deferred.promise;
          }

          var addRestaurantToDB = function(rid, name, lat, long) {
            var deferred = Q.defer();
            doQuery("INSERT INTO Restaurant VALUES($1, $2, $3, $4)", [rid, name,lat,long], function (res, results) {
              deferred.resolve(rid);
            });
            return deferred.promise;
          }

          var loadFromOrdrIn = function(rid) {
            var deferred = Q.defer();
            ordrin_api.restaurant_details({rid: "" + rid}, function(err, data) {
              if (err != null) {
                deferred.reject();
                return;
              }

              var foods = [];
              for (var m in data.menu) {
                var children = data.menu[m].children;
                for (var c in children) {
                  foods.push({name : children[c].name, ID : children[c].id, price : children[c].price});
                }
              }
              deferred.resolve({foods: foods, rid : rid});
            });
            return deferred.promise;
          }

          var storeFoodsInDB = function(rid, foods) {
            var deferred = Q.defer();

            for (var f in foods) {
              f = foods[f];
              doQuery("INSERT INTO Food(FID, RID, Name, Price) VALUES($1,$2,$3,$4)",
              [f.ID, rid, f.name, f.price], function() { deferred.resolve(); });
            }

            // TODO: after doing all inserts, resolve the promise
            return deferred.promise;
          }


          var getFoods = function (res, userID, address, city, zip, lat, long, price, distance) {
            // TODO: Get a list of all foods from those restaurants within price range
            // TODO: Get 4 random foods from that list
            var args = {
              datetime: "ASAP",
              addr: "335 Pioneer Way",
              city: "Mountain View",
              zip: "94041"
            }
            ordrin_api.delivery_list(args, function (error, data) {
              if (error != null) return;
                // yc hacks: 37.3880464, -122.0743169
                var restaurants = filterRestaurants(data, 37.3880464, -122.0743169, distance);

                for (var r in restaurants) {
                  var rid = restaurants[r].id;
                  var name = restaurants[r].na;
                  var lat = restaurants[r].latitude;
                  var long = restaurants[r].longitude;
                  isRestaurantInDB(rid, name, lat, long).then(
                    function() { // in DB
                      // do nothing
                      console.log("A1");
                    },
                    function(data) { // not in DB
                      console.log("A2");
                      return addRestaurantToDB(data.rid, data.name, data.lat, data.long);
                    }
                  ).then(
                    function(rid) { // in DB
                      console.log("B1");
                      return loadFromOrdrIn(rid);
                      // do nothing           },
                    },
                    function() {
                      console.log("B2");
                    }
                  ).then(
                    function(data) {
                      console.log("C1");
                      return storeFoodsInDB(data.rid, data.foods);
                    },
                    function() {
                      console.log("C2");
                      res.end();
                    }
                  ).then(
                    function() {
                      res.end();
                    },
                    function() {
                      res.end();
                    }
                  );
                }

              });
            }

            var setEndpoints = function (server) {
              server.post('/api/like', function(req, re) {
                res = re;
                updateLikeFood(res, true, req.param("user"), req.param("foodID"));
              });
              server.post('/api/dislike', function(req, re) {
                res = re;
                updateLikeFood(res, false, req.param("user"), req.param("foodID"));
              });
              server.get('/food', function(req, re) {
                res = re;
                getFoods(res, req.param("user"), req.param("address"), req.param("city"),
                req.param("zip"), req.param("lat"), req.param("long"), req.param("price"),
                req.param("distance"));
              });
            }

            module.exports.setEndpoints = setEndpoints;
          }());
