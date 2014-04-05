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

function createJsdom(worker, scripts, default_delay, encoding) {
  var request  = require('./request');

  // @url: input
  // @cb: return value
  // a job can only be executed once
  function newJsDomJob(url, cb) {
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

        function process_dom(body) {
          var iconv = require("iconv-lite");
          body = iconv.decode(body, encoding);
          require("jsdom").env(body.toString(),
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
                        cb.call(this, worker.apply(window, extraWorkerArgs));
                      })
                     .append(function() { window.close(); this.yield(); })
                     .appendCallback(tailAction)
                     .yield();
            }
          });
        }

        var res = context.pop();
        if (!res.error && res.response.statusCode === 200) {
          process_dom(res.body);
        } else {
          if (++count < connect_limit) {
            // restart connection
            setup_request();
            context.fire();
          } else {
            console.error("Connection error, exceeds the upper limit for reconnectting");
            process.exit(22);
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
  function newJsDomJobs(generator, delay) {
    if (typeof delay !== 'number') {
      delay = default_delay;
    }
    var tailAction = function() {};
    var extraWorkerArgs = [];

    function nextjob() {
      var item = generator();
      if (!item) {
        setTimeout(tailAction, delay);
      } else {
        (function() {
          var j = newJsDomJob(item[0], item[1]);
          j.setArguments(extraWorkerArgs);
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
    thejobs.setArguments = function() {
      extraWorkerArgs = Array.prototype.slice.call(arguments);
      return thejobs;
    };
    thejobs.setDelay = function(d) { delay = d; return thejobs;};
    return thejobs;
  }

  return function() {
    if (arguments[0] instanceof Url) {
      return newJsDomJob.apply(this, arguments);
    } else if (arguments[0] instanceof Function) {
      return newJsDomJobs.apply(this, arguments);
    }
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


function createPhantom(worker, scripts, default_delay) {

  function newPhJobs(generator, delay) {
    assert(generator instanceof Function);

    if (delay === undefined) {
      delay = default_delay;
    }

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
    var pageSetted = false;

    function theJobs() {
        phantom.create(function(err, ph) {
          phinstance = ph;

          var repeater;

          function repeater_real(page, item, count) {
            if (!item) { item = generator(); }
            count = (count === undefined) ? 0 : count;
            if (item) {
              if (!pageSetted) {
                pageSetted = true;
                page.set('settings', {
                  userAgent: require("../package.json").config.ua,
                  javascriptEnabled: true,
                  loadImages: false
                });
              }

              var url = item[0];
              /* jshint ignore:start */
              var cb = item[1];
              /* jshint ignore:end */
              page.open(url.data(), function(err, status) {
                if (status !== 'success') {
                  //restart connection
                  if (count < connect_limit) {
                    if (count % 10 === 0) {
                      console.error("\tfetch " +  url.data()  + " failed " + (count+1) + " times, retry");
                    }
                    repeater(page, item, count + 1);
                  } else {
                    console.error("Connection error, exceeds the upper limit for reconnectting:" + count);
                    console.error("abort this thread");
                    cleanup();
                    tailAction();
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
          } // end of repeater_real

          repeater = function repeater() {
            var argv = Array.prototype.slice.call(arguments);
            setTimeout(function() {repeater_real.apply(this, argv); }, delay);
          };

          ph.createPage(function(err, page) {
            repeater_real(page);
          });
        }, phantom_config);
      }

    theJobs.run = theJobs;
    theJobs.onEnd = function(t) { tailAction = t; return theJobs;};
    theJobs.setArguments = function() {
      extraWorkerArgs = Array.prototype.slice.call(arguments);
      return theJobs;
    };
    theJobs.setDelay = function(d) { delay = d; return theJobs; };
    return theJobs;
  } // end newPhJobs

  function newPhJob(url, cb) {
    var alive = true;
    return newPhJobs(function() { if (alive) { alive=false; return [url, cb];}});
  }

  return function() {
    var argv = Array.prototype.slice.call(arguments);
    if (argv[0] instanceof Url) {
      return newPhJob.apply(this, argv);
    } else if (argv[0] instanceof Function) {
      return newPhJobs.apply(this, argv);
    }
  };
}

var dom;
dom = function dom(domain, action, forceEngine, forceDelay) {
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

  if (forceEngine === 'auto') {
    forceEngine =  undefined;
  }
  var browser = forceEngine || worker.browser || script.browser;
  switch (browser) {
    case 'jsdom':
      return createJsdom(worker,
                         includejsfiles,
                         forceDelay || script.delay || 0,
                         worker.encoding || script.encoding || 'utf8');
    case 'phantom':
      return createPhantom(worker, includejsfiles, forceDelay || script.delay || 0);
    default:
      throw new Error("no such engine:" + browser);
  }
};

dom.availableEngines = ["jsdom", "phantom", "auto"];

module.exports = dom;
