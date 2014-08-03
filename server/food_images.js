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


var self = {
  fetchImage: function (city, restaurant, dish, callback) {
    // Find the image from foodspotting
    request({
        url: 'https://www.kimonolabs.com/api/bsud6bkq?apikey=GVsRWtElKrFXWZEiOdJ1rmOqN6EEVxIv' + 
            '&kimpath3=' + encodeURIComponent(restaurant + ' ' + dish) +
            '&kimpath5=' + encodeURIComponent(city),
        json: true
      },
      function (error, response, body) {
      
        // Pull the image source out
        if (body && body.count && body.results.item && body.results.item.length &&
          _.first(_.values(body.results.item[0]))) {
            var url = _.first(_.values(body.results.item[0])).src;
            
            console.log('got url!', url);
            
            downloadImage(
              url,
              city + restaurant + dish + '.png',
              function () {
                console.log('successfully downloaded image');
                callback(null, self.getImageUrl(city, restaurant, dish));
              }
            );
        } else {
          callback(
            new Error('failed to fetch image for' + city + restaurant + dish),
            null
          );
        }
      }
    );
  },
  getImageUrl: function (city, restaurant, dish) {
    return '/image/' + city + restaurant + dish + '.png';
  }
};

module.exports = self;
