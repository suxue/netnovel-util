/*global describe, it */

require('chai').should();
var http = require('http');
var dom = require('../lib/dom');
var Url = require('../lib/Url');


describe("dom", function() {
  var server = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<html> <head> <title>hello world</title> </head> <body>It Works!</body> </html>');
  });
  server.listen(52181);

  it('#async#jsdom extract single', function(done) {
    var jsdom = dom('localhost:52181', 'extract');
    var job = jsdom(new Url('http://localhost:52181/'), function(title) {
      title.should.equal('hello world');
      this.yield();
    });
    job.onEnd(function() {
      done();
    });
    job.run();
  });

  it('#async#phantom extract single', function(done) {
    var phdom = dom('localhost:52182', 'extract');
    var job = phdom(new Url('http://localhost:52181/'), function(title) {
      title.should.equal('hello world');
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
          title.should.equal('hello world');
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

  it('#async#phantom extract generator', function(done) {
    var phantomdom = dom('localhost:52182', 'extract');
    var count = 3;
    var jobs = phantomdom(function() {
      if (count > 0) {
        count--;
        return [
          new Url('http://localhost:52181'),
          function(title) {
            title.should.equal('hello world');
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
});
