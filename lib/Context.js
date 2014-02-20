var assert = require('./assert');

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

Context.wrap = function(func) {
  assert(func instanceof Function);
  function result() {
    var argv = [];
    for (var i=0; i < func.length; i++) {
      argv.unshift(this.pop());
    }
    return func.apply(this, argv);
  }
  return result;
};

function setupCallbackOperation(action) {
  var adder = action + "Generator";
  Context.prototype[action + "Callback"] = function() {
    assert(arguments.length >= 1);
    var list;
    var i;
    if (arguments.length === 1) {
      if (arguments[0] instanceof Array) {
        list = arguments[0];
      } else if (arguments[0] instanceof Function) {
        list = [ arguments[0] ];
      } else {
        throw new TypeError();
      }
    } else if (arguments[0] instanceof Function &&
               typeof(arguments[1]) === 'number') {
      list = [];
      for (i=0; i < arguments[1]; i++) {
        list.push(arguments[0]);
      }
    } else {
      list = [];
      for (i=0; i < arguments.length; i++) {
        assert(arguments[i] instanceof Function);
        list.push(arguments[i]);
      }
    }

    this[adder]((function() {
      var i = 0;
      return function() {
        return list[i++];
      };
    })());
    return this;
  };

  assert(! this[action]);
  Context.prototype[action] = function() {
    assert(arguments.length > 0);
    var func_list = [];
    for (var i=0; i < arguments.length; i++) {
      func_list.push(Context.wrap(arguments[i]));
    }
    return this[action + "Callback"].apply(this, func_list);
  };
}

setupCallbackOperation('insert');
setupCallbackOperation('append');
setupCallbackOperation('set');

/// context.append(func_1, func_2, func_3);
//  <====>
//  context.appendCallback(Context.wrap(func_1),
//                         Context.wrap(func_2),
//                         Context.wrap(func_3));
//  <====>
//  context.appendGenerator((function() {
//    var list = [func_1, func_2, func_3];
//    var i = 0;
//    return function() { return list[i]; };
//  })());

module.exports = Context;
