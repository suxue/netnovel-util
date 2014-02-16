
function Context() {
  this.stack = [];
  this.setGenerator();
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

Context.prototype.apply = function(cb, argv) {
  cb.apply(this, argv);
};

Context.prototype.exec = function(cb) {
  var argv = [];
  if (!(cb instanceof Function)) {
    throw new TypeError('callback must be a function');
  } else {
    for (var i = 1; i < arguments.length; i++) {
      argv.push(arguments[i]);
    }
    this.apply(cb, argv);
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

function check_is_function(func) {
  if (!(func instanceof Function)) {
    throw new TypeError("generator must be a function");
  }
}

Context.prototype.setGenerator = function(generator) {
  if (arguments.length === 0) {
    this.generator = function() { return; };
  } else {
    check_is_function(generator);
    this.generator = generator;
  }
  return this;
};

Context.prototype.getGenerator = function() {
  return this.generator;
};

Context.prototype.yield = function() {
  // push arguments
  for (var i=0; i < arguments.length; i++) {
    this.push(arguments[i]);
  }
  var nextProc = this.generator();
  this.exec(nextProc);
};

Context.prototype.fire = function() {
  this.exec(this.getGenerator()());
};

// insert a generator to be consumed after current generator is exhausted
Context.prototype.appendGenerator = function(newgen) {
  var origgen = this.getGenerator();
  check_is_function(newgen);

  return this.setGenerator(function() {
    var func;
    if (!origgen) {
      return newgen();
    } else {
      func = origgen();
      if (func) {
        return func;
      } else {
        origgen = undefined;
        return newgen();
      }
    }
  });
};


// insert newgen right after current func
Context.prototype.insertGenerator = function(newgen) {
  var origgen = this.getGenerator();

  check_is_function(newgen);
  return this.setGenerator(function() {
    var func = newgen();
    if (func) {
      return func;
    } else {
      return origgen();
    }
  });
};

Context.prototype._addCallback = function(adder, cb, num) {
  num = num || 1;

  if (!(cb instanceof Function)) {
    throw new TypeError("callback must be a function");
  } else {
    adder.call(this, (function() {
      var i = 0;
      return function() {
        if (i++ < num) {
          return cb;
        }
      };
    })());
    return this;
  }
};

Context.prototype.insertCallback = function(cb, num) {
  return this._addCallback(this.insertGenerator, cb, num);
};

Context.prototype.appendCallback = function(cb, num) {
  return this._addCallback(this.appendGenerator, cb, num);
};

Context.prototype.setCallback = function(cb, num) {
  return this._addCallback(this.setGenerator, cb, num);
};



module.exports = Context;
