var should = require('chai').should(),
    assert = require('assert'),
    Context = require('../lib/Context');

describe('Context', function(){

  describe("features", function() {
    var con = new Context();
    it("initial state check", function() {
      con.depth().should.equal(0);
    });

    it('simple argument passing (exec)', function() {
      function pass(a, b, c) {
        a.should.equal("hello");
        b.should.equal("world");
        c.should.equal("meet");
      }

      con.push("hello", "world", "meet").exec(function() {
        var args = this.argv(3);
        pass.apply(null, args);
        this.depth().should.equal(0);
      });
    });

    it('summation test', function() {
      con.push(0);
      for (var i=0; i <= 100; i++) {
        con.push(i);
        con.exec(function() {
          var args = this.argv(2);
          this.push(args[0] + args[1]);
        });
      }
      con.pop().should.equal(5050);
      con.depth().should.equal(0);
    });

    it('summation by chain', function() {
      function calculate() {
        var args = this.argv(2);
        this.push(args[0] + args[1]);
      }
      for (var i=0; i <100; i++) {
        con.push(i);
        con.chain(calculate);
      }
      con.push(i);
      con.fire();
      con.pop().should.equal(5050);
      con.depth().should.equal(0);
    });

    it('early return', function() {
      function add() {
        var i = this.at(-1);
        if (i % 7 === 0) {
          this.move(0, this.length());
        } else {
          this.replace(-1, i+1);
        }
      }
      con.clear();
      for (var i=0; i < 100; i++) {
        con.chain(add);
      }

      con.push(1);
      con.fire();
      con.pop().should.equal(7);
    });
  });

});
