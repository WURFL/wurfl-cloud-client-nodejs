var server = require('./server/server.js');
var router = require('./server/router.js');
var exampleApp = require("./exampleApp.js");

var handle = {}
handle["/"] = exampleApp.start;
handle["/start"] = exampleApp.start;
handle["/favicon.ico"] = exampleApp.favicon;
handle["/example"] = exampleApp.example;
handle["/example2"] = exampleApp.example2;


server.start(router.route, handle);