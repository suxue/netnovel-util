/*global describe, it */

var Context = require('../lib/Context');

require('chai').should(),

// jshint expr:true
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

    describe('summation by callback', function() {
      var length = 100, sum = 5050;
      function calculate() {
        var args = this.argv(2);
        this.yield(args[0] + args[1]);
      }

      function final() {
        this.pop().should.equal(sum);
        this.depth().should.equal(0);
      }


      it('set generator', function() {
        for (var i=length; i >= 0; i--) {
          con.push(i);
        }

        con.setGenerator(function() {
          var count = 0;
          return (function() {
            if (count++ < length) {
              return calculate;
            }
          });
        }());
        con.appendGenerator(function() { return final; });
        con.fire();
      });

      it('set callback', function() {
        for (var i=0; i <= length; i++) {
          con.push(i);
        }

        con.setCallback(calculate, length);
        con.appendCallback(final);
        con.fire();
      });
    }); // summation by callback

    it("process the calling chain", function(done) {
      var con = new Context();
      // [ 27500 * 3 - 18307 + 12147 - 1420 + 28043 - 29174 + 2140 - 761 ]

      con.push(0);
      con.appendCallback(
        function() { this.yield(this.pop()  - 1420); },
        function() { this.yield(this.pop()  + 28043); }
      );

      con.insertCallback(
        function() { this.yield(this.pop()  - 18307); },
        function() { this.yield(this.pop()  + 12147); }
      );

      con.insertCallback(
        function() { this.yield(this.pop()  + 27500); },
        3
      );

      con.appendCallback([
          function() { this.yield(this.pop()  - 29174); },
          function() { this.yield(this.pop()  + 2140); },
          function() { this.yield(this.pop()  - 761); },
        ]
      );

      con.appendCallback(function() {
        this.pop().should.equal(75168);
        this.depth().should.equal(0);
        done();
      }).fire();
    });
  });

});
