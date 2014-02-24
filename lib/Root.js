function Root() {}

function make_type_checker(type) {
  if (arguments.length === 0) {
    return function(v) { return v !== undefined; };
  } else {
    do {
      if (typeof(type) === 'string') {
        switch (type) {
          case 'string':
          case 'number':
          case 'boolean':
          case 'object':
            return function(v) { return typeof(v) === type; };
          case 'null':
            return function(v) { return v === null; };
          default:
            break;
        }
      } else if (typeof(type) === 'object' && type instanceof Function) {
        return function(v) { return v instanceof type; };
      }
    } while (0);

    throw new Error("unsupported type name " + type);
  }
}

Root.prototype.inspectProperty = function(propname) {
  return this['##' + propname + '##'];
};

Root.prototype.findAllProperties = (function() {
  var regexp = /^##.+##$/;
  return function findAllProperty() {
    var props = {};
    for (var k in this) {
      if (regexp.test(k)) {
        k = k.slice(2);
        k = k.slice(0, k.length-2);
        props[k] = this.inspectProperty(k);
      }
    }
    props.forEach = function(cb) {
      for (var k in props) {
        if (props.hasOwnProperty(k)) {
          cb(k, props[k]);
        }
      }
    };
    return props;
  };
})();

Root.prototype.defineProperty = function(name, /* optional */ type) {
  var type_checker,
      property = name.slice(0, 1).toUpperCase().concat(name.slice(1));

  if (typeof(this[name]) !== 'undefined') {
    throw new TypeError("property [" + name + "] already defined");
  }

  if (type === undefined) {
    type_checker = make_type_checker();
  } else {
    type_checker = make_type_checker(type);
  }

  this["get" + property] = function() {
    return this[name]();
  };

  this["set" + property] = function(v) {
    this[name](v);
    return this;
  };

  this["delete" + property] = function() {
    if (this["has" + property]) {
      delete this['@' + name];
    }
  };

  this["has" + property] = function() {
    return type_checker(this[name]());
  };

  this['##' + name + '##'] = type || 'anything';

  this[name] = function() {
    switch (arguments.length) {
    case 0: // getter
      return this['@' + name];
    case 1:
      if (arguments[0] === 'undefined') {
        // delete
        delete this['@'+name];
        return this;
      } else if (type_checker(arguments[0]) === true ||
                 arguments[0] === null) {
        // setter
        this['@'+name] =  arguments[0];
        return this;
      } else {
        throw new TypeError('value of property [' + name +'] is in wrong type');
      }
      break;
    default:
      throw new RangeError('wrong number of arguments');
    }
  };
};

module.exports = Root;
