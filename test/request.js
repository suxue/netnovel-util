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
});
