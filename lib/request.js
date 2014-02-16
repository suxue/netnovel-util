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

request.parse_dom = function(url) {
  var config = {url : url};
  setup_config(config);
  var librequest = require('request');

  return function() {
    var context = this;
    assert(context instanceof require('./Context'),
           "wrapped function has no context");
    librequest(config, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        require("jsdom").env(body, {features: false},
                             function(error, window) {
                                  context.yield({
                                    error: error,
                                    window: window,
                                    document: window.document
                                  });
                                });
      } else {
        throw error;
      }
    });
  };
};


module.exports = request;
