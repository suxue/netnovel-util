var should = require('chai').should(),
    assert = require('assert'),
    Context = require('../lib/Context');

describe('Context', function(){

  describe("example 1", function() {
    var con = new Context();
    it("initial state check", function() {
      con.getStackDepth().should.equal(0);

    });

    it('simple argument passing (exec)', function() {
      var output;
      function pass(input) { output = input; }

      con.pushFrame([12345]).exec(pass);
      assert.equal(output, 12345);
      con.popFrame();
    });

    it('simple argument passing (apply)', function() {
      var output;
      function pass(input) { output = input; }

      con.apply(pass, [12345]);
      assert.equal(output, 12345);
      con.popFrame();
    });

    it('simple return value reteriving', function() {
      var count = 100, total = 0;
      for (var i=0; i <= count; i++) {
        con.pushFrame([i]);
      }
      function sum(o) {
        total += o;
      }
      for (i=0; i <= 100; i++) { con.exec(sum).popFrame(); }
      total.should.equal(5050);
    });

  });

});
