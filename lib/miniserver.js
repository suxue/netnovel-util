var http = require('http');
var fs = require('fs');

var docroot = require('path').resolve(__dirname) + "/../www";
var server = http.createServer();

function not_found(res) {
  res.writeHead(404, {'Context-Type': 'text/html'});
  res.end('<?xml version="1.0" encoding="iso-8859-1"?> <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en"> <head> <title>404 - Not Found</title> </head> <body> <h1>404 - Not Found</h1> </body> </html> ');
}

function is_readable(stat) {
  return (stat.mode & 511) & 256;
}

server.on('request', function(req, res) {
  var url = require('url').parse(req.url);
  var pathname = url.pathname;
  //console.log('GET ' + pathname);
  if (pathname === null) {
    not_found(res);
  } else {
    pathname = docroot + pathname;
    fs.stat(pathname, function(err, stats) {
      if (err || !stats.isFile() || !is_readable(stats)) {
        not_found(res);
      } else {
        res.setHeader('Content-Type', 'text/plain');
        var fstream = fs.createReadStream(pathname);
        fstream.pipe(res);
      }
    });
  }
});


var portrange = 40000;

function getPort(cb) {
  var port = portrange;
  portrange += 1;

  var server = require('net').createServer();
  server.listen(port, function () {
    server.once('close', function () {
      cb(port);
    });
    server.close();
  });
  server.on('error', function () {
    getPort(cb);
  });
}

function start_server(cb) {
  getPort(function(port) {
    server.listen(port, function() {
      cb(port);
    });
  });
}

module.exports = start_server;

if (require.main === module) {
  start_server(function(port) {
    console.log("listen on port " + port);
    console.log("server document root is " + docroot);
  });
}
