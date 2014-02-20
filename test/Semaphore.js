/*global describe, it */

var Semaphore = require('../lib/Semaphore');
require('chai').should();

describe("Counter", function() {
  var sema = new Semaphore();
  var v = false;
  it('test semaphore', function() {
    sema.setHook(function () {
      v = true;
    });
    sema.up();
    sema.up();
    v.should.equal(false);
    sema.down();
    v.should.equal(false);
    sema.down();
    v.should.equal(true);
  });
});
