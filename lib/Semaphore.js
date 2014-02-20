var assert = require('../lib/assert');

function Semaphore() {
  this.val = 0;
}

Semaphore.prototype.incr = function() {
  this.val += 1;
};

Semaphore.prototype.decr = function() {
  if (this.val > 0) {
    this.val -= 1;
    if (this.val === 0) {
      if (this._hook instanceof Function) {
        this._hook();
      }
    }
  } else {
    throw new Error("try to decrase on an idle semaphore");
  }
};

Semaphore.prototype.hook = function(hook) {
  assert(hook instanceof Function);
  this._hook = hook;
};

module.exports = Semaphore;
