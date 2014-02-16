var assert = require('./assert');
var Url = require('./Url');

var setup_config = function(config) {
  assert(typeof(config.url) === 'string');
  config.url = (new Url(config.url)).data();
};

if (typeof(process.env.http_proxy) === 'string') {
  setup_config = (function() {
    var orig = setup_config;
    return function(config) {
      config.proxy = process.env.http_proxy;
      orig(config);
    };
  })();
}

function request(config) {
  setup_config(config);

  var librequest = require('request');
  return function() {
    var context = this;
    assert(context instanceof require('./Context'),
           "wrapped function has no context");
    librequest(config, function(error, response, body) {
      context.yield({error: error,
                     response: response,
                     body: body});
    });
  };
}

module.exports = request;
