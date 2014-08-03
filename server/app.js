var express = require('express');
var app = express();
// var bodyParser = require('body-parser')
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded());
var clientAPI = require('./client-api');

app.use(express.static(__dirname + '/public'));

clientAPI.setEndpoints(app);

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
