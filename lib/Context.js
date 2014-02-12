function Context() {
  this.userdata = {};
  this.stack = [];
}

Context.prototype.call = function(func) {
  var argv = [];
  for (var i=1; i < arguments.length; i++) {
    argv.push(arguments[i]);
  }
  return this.apply(func, argv);
};

Context.prototype.apply = function(func, argv) {
  if (!(func instanceof Function)) {
    throw {
      name: 'TypeError',
      message: 'func@1 is not a Function'
    };
  }
  var rc = func.apply(this, argv);
  this.pushFrame(rc);
  return this;
};

Context.prototype.exec = function(func) {
  var frame = this.popFrame();
  this.apply(func, frame);
  return this;
};

Context.prototype.getStackDepth = function() {
  return this.stack.length;
};

Context.prototype.getFrame = function(index) {
  return this.stack[index];
};

Context.prototype.popFrame = function() {
  return this.stack.pop();
};

Context.prototype.pushFrame = function(frame) {
  this.stack.push(frame);
  return this;
};

Context.prototype.getUserData = function() {
  return this.userdata;
};

module.exports = Context;
