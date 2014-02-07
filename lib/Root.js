function Root() {}

function default_type_checker() {
  return true;
}

Root.prototype.defineProperty = function(name, /* optional */ type) {
  var type_checker;

  if (typeof(this[name]) !== 'undefined') {
    throw {
      name: 'ClassError',
      message: "property [" + name + "] already defined"
    };
  }

  if (typeof(type) === 'string') {
    type_checker = function(obj) { return typeof(obj) === type; };
  } else if (typeof(type) === 'object') {
    type_checker = function(obj) { return obj instanceof type; };
  } else {
    type_checker = default_type_checker;
  }

  this[name] = function() {
    switch (arguments.length) {
      case 0: // getter
        return this['@' + name];
      case 1:
        if (typeof(arguments[0]) === 'undefined') {
          // delete
          delete this['@'+name];
          return this;
        } else if (type_checker(arguments[0]) === true ||
                   arguments[0] === null) {
          // setter
          this['@'+name] =  arguments[0];
          return this;
        } else {
          throw {
            name: 'TypeError',
            message: 'value of property [' + name +'] is in wrong type'
          };
        }
        break;
      default:
        throw {
        name: 'FuncError',
        message: 'wrong number of arguments'
      };
    }
  };
};

module.exports = Root;
