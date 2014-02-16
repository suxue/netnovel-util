/*global describe, it */

require('chai').should();
var request = require("../lib/request");
var Context = require("../lib/Context");
var http = require('http');

describe("request", function() {

  it('#async#fetch string', function(done) {
    var con = new Context();
    var message = "okay";
    var port = 52180;
    var server = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(message);
    });
    server.listen(port);

    con.appendCallback(request({
      url: 'localhost:' + port,
    }));

    con.appendCallback(function() {
      var rc = this.pop();
      rc.body.should.equal(message);
      server.close();
      done();
    });

    con.fire();
  });

  it('#async#fetch html', function(done) {
    var con = new Context();
    var title="apache";
    var body = "<html><head><title>" + title +
      "</title><body>It Works!</body></html>";
    var port = 52181;
    var server = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(body);
    });
    server.listen(port);

    con.appendCallback( request.parse_dom('localhost:' + port) );
    con.appendCallback(function() {
      var rc = this.pop();
      rc.document.title.should.equal('apache');
      server.close();
      done();
    });
    con.fire();
  });
});
