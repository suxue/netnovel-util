/*global describe, it */

var Semaphore = require('../lib/Semaphore');
require('chai').should();

describe("Semaphore", function() {
  var sema = new Semaphore();
  var v = false;
  it('test semaphore', function() {
    sema.hook(function () {
      v = true;
    });
    sema.incr();
    sema.incr();
    v.should.equal(false);
    sema.decr();
    v.should.equal(false);
    sema.decr();
    v.should.equal(true);
  });
});
