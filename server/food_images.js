var Q = require('q'),
    fs = require('fs'),
    request = require('request'),
    _ = require('underscore');

var downloadImage = function (uri, filename, callback) {
  request.head(uri, function (err, res, body) {
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(
      'public/image/' + filename, {flags: 'w'})).on('close', callback);
  });
};


var getName = function (city, restaurant, dish) {
  city = city.replace(/\s+/g, '').replace(/[()]/g,'');
  restaurant = restaurant.replace(/\s+/g, '').replace(/[()]/g,'');
  dish = dish.replace(/\s+/g, '').replace(/[()]/g,'');
  return encodeURIComponent(city + '-' + restaurant + '-' + dish);
}

var self = {
  fetchImage: function (city, restaurant, dish, id, callback) {
    // Find the image from foodspotting
    request({
        url: 'https://www.kimonolabs.com/api/bqillbx4?apikey=KyQA8Fet0sy6SMIEAiXUR7trgdPg0eFM' +
            '&kimpath3=' + encodeURIComponent(restaurant + ' ' + dish) +
            '&kimpath5=' + encodeURIComponent(city),
        json: true
      },
      function (error, response, body) {
        // Pull the image source out
        if (body.count && body.lastrunstatus === "success"
            && body.results.images && body.results.images.length &&
          _.first(_.values(body.results.images[0]))) {
            var url = _.first(_.values(body.results.images[0])).src;

          //  console.log('got url!', url);

            downloadImage(
              url,
              getName(city, restaurant, dish) + '.png',
              function () {
              //  console.log('successfully downloaded image');
                callback(null, self.getImageUrl(city, restaurant, dish), id);
              }
            );
        } else {
          callback(
            new Error('failed to fetch image for' + city + restaurant + dish),
            null,
            id
          );
        }
      }
    );
  },
  getImageUrl: function (city, restaurant, dish) {
    return '/image/' + getName(city, restaurant, dish) + '.png';
  }
};

module.exports = self;
