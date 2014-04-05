/*global describe, it */

require('chai').should();
var dom = require('../lib/dom');
var Url = require('../lib/Url');


function server1_handler(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<html> <head> <title>hello jsdom</title> </head> <body>It Works!</body> </html>');
}

var server1 = require("http").createServer(server1_handler);
server1.listen(52181);

server1.on("listening", function() {
  describe("Jsdom", function() {
    it('#async#jsdom extract single', function(done) {
      var jsdom = dom('localhost:52181', 'extract');
      var job = jsdom(new Url('http://localhost:52181/'), function(title) {
        title.should.equal('hello jsdom');
        this.yield();
      });
      job.onEnd(function() {
        done();
      });
      job.run();
    });

    it('#async#jsdom extract generator', function(done) {
      var jsdom = dom('localhost:52181', 'extract');
      var count = 3;
      function generator() {
        if (count > 0) {
          count--;
          return [new Url('http://localhost:52181/'), function(title) {
            title.should.equal('hello jsdom');
            this.yield();
          }];
        }
      }
      var jobs = jsdom(generator);
      jobs.onEnd(function() {
        count.should.equal(0);
        done();
      });
      jobs.run();
    });
  });
});

function server2_handler(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<html> <head> <title>hello phantom</title> </head> <body>It Works!</body> </html>');
}
var server2 = require("http").createServer(server2_handler);
server2.listen(52182);

server2.on("listening", function() {
  describe("Phantom", function() {

    it('#ASYNC#phantom extract generator', function(done) {
      var phantomdom = dom('localhost:52182', 'extract');
      var count = 3;
      var jobs = phantomdom(function() {
        if (count > 0) {
          count--;
          return [
            new Url('http://localhost:52182'),
            function(title) {
              title.should.equal('hello phantom');
              this.yield();
            }
          ];
        }
      });
      jobs.onEnd(function() {
        count.should.equal(0);
        done();
      });
      jobs.run();
    });

    it('#ASYNC#phantom extract single', function(done) {
      var phdom = dom('localhost:52182', 'extract');
      var job = phdom(new Url('http://localhost:52182/'), function(title) {
        title.should.equal('hello phantom');
        this.yield();
      });
      job.onEnd(function() {
        done();
      });
      job.run();
    });
  });
});
