#!/usr/bin/env node

var static = require('node-static');

// serve the current directory
var file = new static.Server('.');

console.log('Serving at: http://127.0.0.1:8000');
require('http').createServer(function (request, response) {
  request.addListener('end', function () {
    file.serve(request, response);
  }).resume();
}).listen(8000);
