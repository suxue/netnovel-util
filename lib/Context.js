function Context() {
  this.userdata = {};
  this.stack = [];
  this.clear();
}


Context.prototype.depth = function() {
  return this.stack.length;
};

Context.prototype.at = function(i) {
  if (i >= 0) {
    return this.stack[i];
  } else {
    return this.stack[this.stack.length + i];
  }
};

Context.prototype.replace = function(i, v) {
  if (i >= 0) {
    this.stack[i] = v;
  } else {
    this.stack[this.stack.length + i] = v;
  }
  return this;
};

Context.prototype.push = function() {
  for (var i=0; i < arguments.length; i++) {
    this.stack.push(arguments[i]);
  }
  return this;
};

Context.prototype.pop = function() {
  return this.stack.pop();
};


Context.prototype.shrink = function(len) {
  for (var i=0; i < len; i++) {
    this.stack.pop();
  }
  return this;
};

Context.prototype.exec = function(cb) {
  if (!(cb instanceof Function)) {
    throw {name: 'TypeError'};
  } else {
    cb.call(this);
    return this;
  }
};

Context.prototype.argv = function(len) {
  var args = [];
  for (var i=0; i <len; i++) {
    args.unshift(this.pop());
  }
  return args;
};

Context.prototype.chain = function() {
  var cb;
  for (var i=0; i < arguments.length; i++) {
    cb = arguments[i];
    if (!(cb instanceof Function)) {
      throw {name: 'TypeError'};
    } else {
      this.procs.push(cb);
    }
  }
};


// move proc chain pointer
Context.prototype.move = function(offset, base) {
  if (arguments.length == 1) {
    base = this.cursor;
  }
  this.cursor = base + offset;
};

Context.prototype.fire = function() {
  var c;
  while (this.cursor < this.length() && this.cursor >= 0) {
    c = this.cursor;
    this.exec(this.procs[c]);
    if (c === this.cursor) {
      this.cursor++;
    }
  }
};

Context.prototype.length = function() {
  return this.procs.length;
};

Context.prototype.clear = function() {
  this.procs = [];
  this.cursor = 0;
};

Context.prototype.setChain = function(chain) {
  this.chain = chain;
  this.cursor = 0;
};

module.exports = Context;
