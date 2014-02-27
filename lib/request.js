var assert = require('./assert');
var Url = require('./Url');

var setup_config = function(config) {
  assert(typeof(config.url) === 'string');
  config.url = (new Url(config.url)).data();
  config.headers = {
    'Accept-Language': 'zh,en-us;q=0.7,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': '1',
    'User-Agent': require("../package.json").config.ua
  };
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
      var headers = response.headers;

      (function(enc) {
        if (enc === undefined) {
          context.yield({error: error,
                        response: response,
                        body: body});
        } else if (enc === 'gzip') {
          require("zlib").gunzip(body, function(err, body) {
            if (err) {
              throw err;
            } else {
              context.yield({error: error,
                            response: response,
                            body: body});
            }
          });
        } else if (enc === 'deflate' ) {
          require("zlib").inflate(body, function(err, body) {
            if (err) {
              throw err;
            } else {
              context.yield({error: error,
                            response: response,
                            body: body});
            }
          });
        } else {
          throw new Error("unrecognized encoding of http response");
        }
      })(headers['content-encoding']);
    });
  };
}

module.exports = request;
