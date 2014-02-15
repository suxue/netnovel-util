function Root() {}

function default_type_checker() {
  return true;
}

Root.prototype.defineProperty = function(name, /* optional */ type) {
  var type_checker,
      property = name.slice(0, 1).toUpperCase().concat(name.slice(1));

  if (typeof(this[name]) !== 'undefined') {
    throw new TypeError("property [" + name + "] already defined");
  }

  if (typeof(type) === 'string') {
    type_checker = function(obj) { return typeof(obj) === type; };
  } else if (typeof(type) === 'object') {
    type_checker = function(obj) { return obj instanceof type; };
  } else {
    type_checker = default_type_checker;
  }

  this["get" + property] = function() {
    return this[name]();
  };

  this["set" + property] = function(v) {
    this[name](v);
    return this;
  };

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
