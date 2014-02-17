/*global describe, it */

var Counter = require('../lib/Counter');
require('chai').should();

describe("Counter", function() {
  var counter = new Counter();
  var v = false;
  it('test counter', function() {
    counter.setHook(function () {
      v = true;
    });
    counter.up();
    counter.up();
    v.should.equal(false);
    counter.down();
    v.should.equal(false);
    counter.down();
    v.should.equal(true);
  });
});
