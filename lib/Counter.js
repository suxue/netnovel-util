var assert = require('../lib/assert');

function Counter(initval) {
  if (typeof(initval) === 'number') {
    this.val = initval;
  } else {
    this.val = 0;
  }
}

Counter.prototype.up = function() {
  this.val += 1;
};

Counter.prototype.down = function() {
  if (--this.val === 0) {
    if (this.hook instanceof Function) {
      this.hook();
    }
  }
};

Counter.prototype.setHook = function(hook) {
  assert(hook instanceof Function);
  this.hook = hook;
};

module.exports = Counter;
