var assert = require('./assert');
var Url = require('./Url');
var Context = require('./Context');

var verb_noun_map = {
  "extract": 'extractor',
  'index': "indexer"
};

function dom() {
  throw new Error("this function should not be called directly");
}

var connect_limit = 500;

var reformat_worker = (function() {
  var regexp = /^\s*function\s+([a-zA-Z_$][a-zA-Z_$0-9]+)?\((.*)\)\s*([\s\S]+)/;
  return function reformat_worker(in_worker) {
    var res = regexp.exec(in_worker.toString());
    var funcname = res[1] || '';
    var arglist = res[2];
    var body = res[3];
    /* jshint evil:true */
    var resfunc = eval('var the_generated_function = function' + funcname + '(' + arglist +'){ var window = this; with(window) { ' + body + '}}; the_generated_function;');
    /* jshint evil:false*/
    return resfunc;
  };
})();

function createJsdom(worker, scripts, encoding) {
  var request  = require('./request');

  // @url: input
  // @cb: return value
  // a job can only be executed once
  function newJob(url, cb) {
    assert(url instanceof Url);
    assert(cb instanceof Function);
    var count = 0;
    var config = {url: url.data(), encoding: null};
    var context = new Context();
    var tailAction = function() {};
    var extraWorkerArgs = [];

    function setup_request() {
      context.appendCallback(request(config));
      context.append(function() {
        var res = context.pop();
        if (!res.error && res.response.statusCode === 200) {
          var iconv = require("iconv-lite");
          res.body = iconv.decode(res.body, encoding);
          require("jsdom").env(res.body.toString("utf8"),
                               scripts,
                               {url: url.data(), features: false},
                               function(error, window) {
                                  context.yield(error, window);
                                });
          context.append(function(error, window) {
            if (error) {
              throw new Error("dom error");
            } else {
              context.appendCallback(function() {
                        cb.call(this, reformat_worker(worker).apply(window, extraWorkerArgs));
                      })
                     .appendCallback(tailAction)
                     .yield();
            }
          });
        } else {
          if (++count < connect_limit) {
            // restart connection
            setup_request();
            context.fire();
          } else {
            throw new Error("Connection error, exceeds the upper limit for reconnectting");
          }
        }
      });
    }

    setup_request();
    function thejob() { context.fire(); }
    thejob.onEnd = function(t) {
      assert(t instanceof Function);
      tailAction = t;
      return thejob;
    };
    thejob.setArguments = function() {
      extraWorkerArgs = Array.prototype.slice.call(arguments);
      return thejob;
    };
    thejob.run = function() { thejob(); return thejob;};
    return thejob;
  }

  // generator produce items like
  // [url, cb] || undefined
  function newJobs(generator) {
    var tailAction = function() {};

    function nextjob() {
      var item = generator();
      if (!item) {
        tailAction();
      } else {
        (function() {
          var j = newJob(item[0], item[1]);
          j.onEnd(nextjob);
          j.run();
        })();
      }
    }

    function thejobs() {
      nextjob();
    }
    thejobs.onEnd = function(func) {
      assert(func instanceof Function);
      tailAction = func;
      return thejobs;
    };
    thejobs.run = function() { thejobs(); };
    return thejobs;
  }

  return function() {
    assert(arguments.length === 1 || arguments.length === 2);
    var argv = Array.prototype.slice.call(arguments);
    return (argv.length === 1) ? newJobs.apply(this, argv)
                               : newJob.apply(this, argv);
  };
}

function prepare_phantom_config() {
  var proxy_pat = /^http:\/\/((.+):(.+)@)?(.+)$/;
  var config = { 'load-images': 'false' };
  if (process.env.http_proxy) {
    var res = proxy_pat.exec(process.env.http_proxy);
    if (res) {
      config.proxy = res[4];
      if (res[1]) {
        config['proxy-auth'] = res[2] + ':' + res[3];
      }
    }
  }
  return { parameters: config};
}

var phantom_config = prepare_phantom_config();


function createPhantom(worker, scripts) {
  function newJobs(generator) {
    assert(generator instanceof Function);

    var phinstance = null;
    function cleanup() {
      if (phinstance) {
        phinstance.exit();
        phinstance=null;
      }
    }
    var tailAction = function() {};
    var phantom = require('node-phantom-simple');
    var extraWorkerArgs = [];

    function theJobs() {
        phantom.create(function(err, ph) {
          phinstance = ph;

          function repeater(page, item, count) {
            if (!item) { item = generator(); }
            count = (count === undefined) ? 0 : count;
            if (item) {
              var url = item[0];
              /* jshint ignore:start */
              var cb = item[1];
              /* jshint ignore:end */
              page.open(url.data(), function(err, status) {
                if (status !== 'success') {
                  //restart connection
                  if (count < connect_limit) {
                    setTimeout(function() {
                      repeater(page, item, count + 1);
                    }, 100*count);
                  } else {
                    throw new Error("Connection error, exceeds the upper limit for reconnectting:" + count);
                  }
                } else {
                  var pageeval = function() {
                  /*jshint evil:true */
                    eval('page.evaluate( function() { return (' + worker.toString() + ').apply(window, ' + JSON.stringify(extraWorkerArgs) + ');' + '}, ' + 'function(err, result) {' + 'cb.call({yield: function() { repeater(page); }}, result);});');
                  /*jshint evil:false*/
                  };
                  var env = new Context();
                  scripts.forEach(function(url) {
                    env.append(function() {
                      page.includeJs(url, function() {
                        env.yield();
                      });
                    });
                  });
                  env.append(pageeval);
                  env.fire();
                }
              });
            } else {
              cleanup();
              tailAction();
            }
          } // end of repeater

          ph.createPage(function(err, page) {
            repeater(page);
          });
        }, phantom_config);
      }

    theJobs.run = theJobs;
    theJobs.onEnd = function(t) { tailAction = t; return theJobs;};
    theJobs.setArguments = function() {
      extraWorkerArgs = Array.prototype.slice.call(arguments);
      return theJobs;
    };
    return theJobs;
  } // end newJobs

  function newJob(url, cb) {
    var alive = true;
    return newJobs(function() { if (alive) { alive=false; return [url, cb];}});
  }

  return function() {
    assert(arguments.length === 1 || arguments.length === 2);
    var argv = Array.prototype.slice.call(arguments);
    return (argv.length === 1) ? newJobs.apply(this, argv)
                               : newJob.apply(this, argv);
  };
}


function dom(domain, action) {
  assert(verb_noun_map.hasOwnProperty(action));
  assert(typeof domain === 'string');

  var list = domain.split('.').reverse();
  var script = null;
  list.unshift('./sites');
  while (script === null && list.length > 0) {
    try {
      script = require(list.join('/'));
    } catch(e) {
      list.pop();
    }
  }
  if (script === null) {
    throw new Error('site script not found for domain ' + domain);
  }

  var worker = script[verb_noun_map[action]];
  assert(worker instanceof Function);

  script.browser = script.browser || 'jsdom';
  var jsfiles = script.scripts || [];
  var includejsfiles = [];
  var isLocalJs = (function() {
    var regexp = /^http:\/\//;
    return function(url) {
      return !regexp.test(url);
    };
  })();
  jsfiles.forEach(function(path) {
    if (isLocalJs(path)) {
      includejsfiles.push(global.LOCAL_MINISERVER(path));
    } else {
      includejsfiles.push(path);
    }
  });

  switch (script.browser) {
    case 'jsdom':
      return createJsdom(worker, includejsfiles, script.encoding || 'utf8');
    case 'phantom':
      return createPhantom(worker, includejsfiles);
    default:
      throw new Error("should not reach here");
  }
}

module.exports = dom;
