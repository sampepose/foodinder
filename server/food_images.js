var Q = require('q'),
    fs = require('fs'),
    request = require('request');

var downloadImage = function (uri, filename, callback) {
  request.head(uri, function (err, res, body) {
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(
      'public/image/' + filename, {flags: 'w'})).on('close', callback);
  });
};


module.exports = {
  fetchImage: function (city, restaurant, dish) {
    console.log('downloading an image for', city, restaurant, dish);
    request('some/kimono/api/endpoint', function (error, response, body) {
      var url = body.something;
      downloadImage(
        'https://www.google.com/images/srpr/logo3w.png',
        city + restaurant + dish + '.png',
        function () {
          console.log('done');
        }
      );
    });
  },
  getImageUrl: function (city, restaurant, dish) {
    return '/image/' + city + restaurant + dish + '.png';
  }
};


