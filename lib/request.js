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
  assert(url instanceof Url);
  var config = {url : url.data(), encoding: null};
  setup_config(config);

  var connect_limit = 5;

  return function() {
    var context = this;
    assert(context instanceof require('./Context'),
           "wrapped function has no context");

    var last_step;

    function domify() {
      var res = context.pop();
      if (!res.error && res.response.statusCode === 200) {
        var iconv = require("iconv-lite");
        res.body = iconv.decode(res.body, url.getScript().encoding);
        require("jsdom").env(res.body.toString("utf8"),
                             {url: url.data(), features: false},
                             function(error, window) {
                                  context.yield({
                                    error: error,
                                    window: window,
                                    document: window.document
                                  });
                                });
      } else {
        if (connect_limit-- > 0) {
          last_step();
        } else {
          throw new Error("Connection error, exceeds the upper limit for reconnectting");
        }
      }
    }

    last_step = function() {
      context.insertCallback(request(config), domify).fire();
    };
    last_step();
  };
};


module.exports = request;
