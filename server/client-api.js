(function() {
  var ordrin = require("ordrin-api");
  // Initialize with your application secret key
  var ordrin_api = new  ordrin.APIs("44qby0ZpVX7xyc-bBbzrtKuVT9bvHAZ7yjbl2Mf2McE");

  var food_images = require("./food_images");

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

  var doQuery = function (res, sql, data, cb) {
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
          res.write(JSON.stringify(affected_rows[0], null, 4));
          else
            res.write(JSON.stringify(affected_rows, null, 4));
            res.end();
          } else {
            res.end();
          }
        });

        query.on('error', function (error) {
          console.log("SQL ERROR: " + error);

          //           res.writeHead(200, {'Content-Type':'text/plain'});
          res.write(error + "\n \t from: " + query.text + '\n');
          res.end();
        });
      }

      var updateLikeFood = function (res, like, userID, foodID) {
        doQuery(res, "UPDATE Like SET Liked = $1 WHERE UID = $2 AND FID = $3;", [like, userID, foodID]);
      }

      var getLikes = function (res, userID) {
        //TODO: Just get names, or images, or what?
      }



      var isRestaurantInDB = function(rid, name, lat, long, city) {
        var deferred = Q.defer();
        doQuery(res, "SELECT * FROM Food WHERE RID = $1 AND imagepath IS NULL;", [rid], function (res, results) {
          if (results.length == 0)
            deferred.reject(null);
            else
              deferred.resolve({foods: results, rid : rid, name: name, city: city});
            });
            return deferred.promise;
          }

          var addRestaurantToDB = function(rid, name, lat, long) {
            var deferred = Q.defer();
            doQuery(res, "INSERT INTO Restaurant VALUES($1, $2, $3, $4)", [rid, name,lat,long], function (res, results) {
              deferred.resolve(rid);
            });
            return deferred.promise;
          }

          var loadFromOrdrIn = function(rid) {
            var deferred = Q.defer();
            ordrin_api.restaurant_details({rid: "" + rid}, function(err, data) {
              if (err != null) {
                //console.log("Ordrin error: " + err);
              //  console.log(err);
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
              doQuery(res, "INSERT INTO Food(FID, RID, Name, Price) VALUES($1,$2,$3,$4)",
              [f.ID, rid, f.name, f.price], function() { deferred.resolve(foods); });
            }

            // TODO: after doing all inserts, resolve the promise
            return deferred.promise;
          }

          var getFoods = function(res, user, price) {
              if (restaurantIDs.length == 0) {
                res.writeHead(200, {'Content-Type':'text/plain'});
                res.write(JSON.stringify([]));
                res.end();
              } else {
                var qs = "SELECT * FROM FOOD WHERE FID NOT IN (SELECT FID FROM Likes WHERE UID = $1 AND Liked IS NOT NULL)" +
                  " AND (RID = $2 OR RID = $3 OR RID = $4) AND Price <= $5" +
                  " LIMIT 3;"
                  var rid1 = restaurantIDs[Math.floor(Math.random()*restaurantIDs.length)];
                  var rid2 = restaurantIDs[Math.floor(Math.random()*restaurantIDs.length)];
                  var rid3 = restaurantIDs[Math.floor(Math.random()*restaurantIDs.length)];
                  doQuery(res, qs, [user, rid1, rid2, rid3, price]);
              }
          }

          var loadImages = function (res, rName, foods, city) {
            var deferred = Q.defer();

            for (var f in foods) {
              f = foods[f];
              food_images.fetchImage(city, rName, f.name, f.fid, function (error, imageUrl, fID) {
                //  console.log(error);
                if (error) {
                  //console.error(error.message);
                } else {
                  console.log("SQL....");
                  console.log(imageUrl);
                  console.log(fID);
                  var qs = "UPDATE Food SET ImagePath = $1 WHERE FID = $2;"
                    doQuery(res, qs, [imageUrl, fID]);
                }
              });
            }

            return deferred.promise;
          }

          var restaurantIDs = [];
          var onAppInit = function (res, userID, address, city, zip, lat, long, distance) {
            restaurantIDs.length = 0;
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
                  restaurantIDs.push(rid);
                  var name = restaurants[r].na;
                  var lat = restaurants[r].latitude;
                  var long = restaurants[r].longitude;
                  var c = restaurants[r].full_addr.city;
                  isRestaurantInDB(rid, name, lat, long, c).then(
                    function(data) { // in DB
                      console.log("A1");
                      var deferred = Q.defer();
                      deferred.reject(data);
                      return deferred.promise;
                    },
                    function(data) { // not in DB
                      console.log("A2");
                      return addRestaurantToDB(data.rid, data.name, data.lat, data.long);
                    }
                  ).then(
                    function(rid) { //
                      console.log("B1");
                      return loadFromOrdrIn(rid);
                      // do nothing           },
                    },
                    function(data) {
                      console.log("B2");
                      var deferred = Q.defer();
                      deferred.reject(data);
                      return deferred.promise;
                    }
                  ).then(
                    function(data) {
                      console.log("C1");
                      return storeFoodsInDB(data.rid, data.foods);
                    },
                    function(data) {
                      console.log("C2");
                      var deferred = Q.defer();
                      deferred.resolve(data);
                      return deferred.promise;
                    }
                  ).then(
                    function(data) {
                      console.log("D1\n---");
                      if (data == null) return;
                      return loadImages(res, data.name, data.foods, data.city);
                    },
                    function() {
                      console.log("D2\n---");
                      res.end();
                    }
                  );
                }

              });
            }

            var setEndpoints = function (server) {
              server.post('/api/like', function(req, res) {
                updateLikeFood(res, true, req.param("user"), req.param("foodID"));
              });
              server.post('/api/dislike', function(req, res) {
                updateLikeFood(res, false, req.param("user"), req.param("foodID"));
              });
              server.get('/init', function(req, res) {
                onAppInit(res, req.param("user"), req.param("address"), req.param("city"),
                          req.param("zip"), req.param("lat"), req.param("long"), req.param("distance"));
              });
              server.get('/food', function(req, res) {
                getFoods(res, req.param("user"), req.param("price"));
              });
            }

            module.exports.setEndpoints = setEndpoints;
          }());
