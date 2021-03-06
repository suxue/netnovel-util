var fs = require("fs");

var Context  = require('../lib/Context');
var Semaphore = require('../lib/Semaphore');
var Index = require('../lib/Index');
var Url = require('../lib/Url');
var assert = require('../lib/assert');
var request = require('../lib/request');

var miniserver = null;

function quitapp(code) {
  if (miniserver) {
    process.stderr.write = function() {};
    miniserver.close();
  }
  process.on("exit", function() {
    process.exit(code);
  });
}

(function(){
// setup fallback error reporting
//
  Error.stackTraceLimit = Infinity;
  process.on('uncaughtException', function(err) {
    if (typeof err === 'object' && typeof err.name === 'string') {
      if (err.message) {
        console.log('\nMessage: \033[31;1m' + err.message + '\033[0m');
      }
      console.log(err.stack);
    } else {
      console.log('dumpError :: argument is not an object');
    }
    quitapp(99);
  });
})();


function save_index$A(filename, index) {
  assert(typeof filename === 'string');
  assert(index instanceof Index);
  var con = this;
  var out;
  if (filename !== '-') {
    out = fs.createWriteStream(filename);
  } else {
    out = process.stdout;
  }
  out.write(index.toJSON(), function() {
    if (out !== process.stdout) {
      console.log("index writen to " + filename);
    }
    con.yield();
  });
}

/////
//    FuncName$A means this function is meant to be used as part of
//    an asynchronize calling chain and its input parameters should be
//    filled by its caller
////
function print_index$A(index) {
  assert(index instanceof Index);

  function print() {
    var argv = Array.prototype.slice.call(arguments);
    argv.push('\n');
    process.stdout.write(argv.join(''));
  }

  print("title:\t", index.title());
  print("author:\t", index.author());
  print("brief:\t", index.brief());
  if (index.coverUrl()) {
    print("cover:\t", index.coverUrl());
  }
  print("==== Table of Contents ====");
  index.debugPrint(print);
  this.yield();
}

function read_index$A(url, model) {
  assert(url instanceof Url);
  /////////////////////////////////
  var dom = require("../lib/dom")(url.getDomain(), 'index', model);

  function repeater$A(top) {
    assert(top && typeof top === 'object');
    if (typeof top.url !== 'string') {
      this.yield(Index.weave(top));
    } else {
      this.insert(
        function() {
          var context = this;
          var job = dom((new Url(top.url)),
                        function(r) { this.yield(); context.yield(r); });
          job.setArguments(top);
          job.run();
        },
        repeater$A
      ).yield();
    }
  }

  this.insert(repeater$A).yield({url: url.data(), href: url.data()});
}


function fetch_chapter$A(urlstr, model) {
  assert(typeof urlstr === 'string');
  var url = new Url(urlstr);
  ///////////////////////////////////////////////////

  var context = this;
  var dom = require('../lib/dom')(url.getDomain(), 'extract', model);
  var job = dom(url, function(html) {
    this.yield();
    context.yield(html);
  });
  job.run();
}

function download_index$A(config, index, model, delay, override) {
  assert(typeof config  === 'object');
  assert(index instanceof Index);

  var length = index.getStatistics().leafCount;
  var sema = new Semaphore();
  var count = config.start;
  var i;
  var context = this;
  var skipCount = 0;
  var skipedCount = 0;

  sema.hook(function() {
    console.log('\n  fetching complete, writen out to: ' + config.outdir);
    context.yield();
  });

  // write index.json
  sema.incr();
  fs.writeFile(config.outdir + "/index.json", index.toJSON(), function() {
    console.log("write index.json");
    sema.decr();
  });


  // fetch cover picture
  if (index.coverUrl()) {
    fs.exists(config.outdir + '/cover.jpg', function (exists) {
      if (!override && exists) {
        skipCount++;
        return;
      }
      sema.incr();
      (function() {
        var con = new Context();
        con.set(
          // set encoding to null to get binary response(node Buffer)
          request({url: index.coverUrl(),
                  encoding: null,
                  headers: {Referer: 'http://' + (new Url(index.coverUrl())).getDomain()}
          }),
          function (data) {
            var body = data.body;
            fs.writeFileSync(config.outdir + "/cover.jpg", body);
            console.log("write cover.jpg");
            sema.decr();
          }
        ).fire();
      })();
    });
  }

  // skip n items to reeach start point
  var item_generator = index.getLeafIterator();
  for (i = 1; i < config.start; i++) { item_generator(); }

  var href = index.href();
  var url = new Url(href);
  var dom = require('../lib/dom')(url.getDomain(), 'extract', model, delay);
  function generator() {
    var item = item_generator();
    if (!item) {
      return undefined;
    }

    var href = item.url;
    var url = new Url(decodeURI(href));
    var name = item.name;
    var filename = url.getFileName();
    var message = function() {
      return ((count++) + skipedCount + skipCount) + '/' + length + ' (' + filename.slice(0,5) + ') : ' + name;
    };
    if (!override && fs.existsSync(config.outdir + "/" + filename)) {
      skipCount++;
      return generator();
    } else {
      if (skipCount > 0) {
        console.error("\033[31;1mskip \033[32;1m" + skipCount + '\033[31;1m items which is present in output dir\033[0m');
        skipedCount += skipCount;
        skipCount = 0;
      }
      return [
        url,
        function(html) {
          sema.incr();
          fs.writeFile(config.outdir + "/" + filename, html, function() {
            console.log("fetch ", message());
            sema.decr();
          });
          this.yield();
        }
      ];
    }
  }

  function run(task_id) {
    if (task_id > 0) {
      sema.incr();
      dom(generator).onEnd(function() { sema.decr(); }).run();
      setTimeout(function() { run(task_id - 1); }, delay);
    } else {
      sema.decr();
    }
  }
  sema.incr();
  run(config.concurrency);
}

function list_scripts(genpath, path) {
  function p(a, b) {
    var len = 30;
    var diff = len - a.length;
    for (var i=0; i < diff; i++) {
      b = " " + b;
    }
    console.log(" * http://" + a + b);
  }

  var stat = fs.statSync(genpath(path.join('/')));
  if (stat.isFile()) {
    var mod = require("../lib/sites/" + path.join('/'));
    path = path.reverse();
    if (path[0] === 'index.js') {
      path.shift();
    } else {
      path[0] = path[0].slice(0, path[0].length - 3);
    }
    path.reverse();
    p(path.reverse().join("."), mod.name ?  mod.name : '');
  } else if (stat.isDirectory()) {
    var dirs = fs.readdirSync(genpath(path.join('/')));
    dirs.forEach(function(dir) {
      list_scripts(genpath, path.concat(dir));
    });
  }
}

function main(argv) {
  // for 'node debug'
  if (argv[1] === "debug") {
    argv = argv.slice(0,1).concat(argv.slice(2));
  }

  var program = require('commander'),
      package_json = require('../package.json'),
      commands = {};

  program.option("-l, --list", "list misc program information");

  function error(msg) {
    console.error("error: " + program._name +  ": " + msg);
    quitapp(1);
  }

  function check_existstence(prop) {
    if (!program[prop]) {
      error("--" + prop + " is required");
    }
  }

  function define_subcommand(cmd, obj) {
    obj.name = cmd;
    commands[cmd] = obj;
  }

  define_subcommand('index', {
    description: 'fetch and print book index and metadata',
    setup: function() {
      program.option("\n\b\b[index]:", "");
      program.option("-i, --input [file]", "the index file to be parsed (- as stdin)");
      program.option("-u, --url [url]", "the url to be indexed");
      program.option("-o, --out [file]", "write index to file");
      program.option("-b, --browser [model]", "browser backend to use", 'auto');
    },
    action: function() {
      var con = new Context();

      if (program.url !== undefined) {
        con.push(new Url(program.url), program.browser)
           .append(read_index$A);
      } else if (program.input !== undefined) {
        con.append((function() {
          var data = [];
          return function() {
            var input;
            var context = this;
            if (program.input === '-') {
              input = process.stdin;
            } else {
              input = fs.createReadStream(program.input);
            }
            input.setEncoding("utf-8");
            input.on("data", function(d) {
              data.push(d);
            });
            input.on("error", function() {
              error("IO error occurs when reading from " + program.input);
            });
            input.on('end', function() {
              context.yield(Index.loadJSON(data.join("")));
            });
          };
        })());
        //con.push(Index.loadJSON(fs.readFileSync(program.input)));
      } else {
        error("no url or index file speciified, abort");
      }

      if (program.out !== undefined) {
        con.unshift(program.out)
           .append(save_index$A);
      } else {
        con.append(print_index$A);
      }
      con.append(quitapp);
      con.fire();
    },
  });

  define_subcommand('download', {
    description: "download chapters from index",
    setup: function() {
      program
        .option("\n\b\b[download]:", "")
        .option("-u, --url [url]", "the url of index")
        .option("-i, --index [file]", "read index from saved file (- as stdin)")
        .option("-o, --out [dir]", "the target directory of fetched files")
        .option("-d, --delay [milesecond]", "delay between two request")
        .option("-s, --start [pos]", "the start point (1-based) of downloading", "1")
        .option("-n, --concurrency [num]", "establish [num] connections concurrently", "5")
        .option("-b, --browser [model]", "browser backend to use", 'auto')
        .option("-f, --force", "force override existing files");
    },
    action: function() {
      var fs = require("fs"),
          stat;

      check_existstence("out");
      if (!fs.existsSync(program.out)) {
        error("folder " + program.out + " does not exist");
      }

      stat = fs.statSync(program.out);
      if (!stat.isDirectory()) {
        error(program.out + " is not a directory");
      }


      if (typeof program.delay === 'string') {
        program.delay = parseInt(program.delay, 10);
        if (isNaN(program.delay)) {
          delete program.delay;
        }
      } else {
        program.delay = 0;
      }

      var con = new Context();
      con.push({
        start: parseInt(program.start, 10),
        concurrency: parseInt(program.concurrency, 10),
        outdir: program.out
      });
      if (typeof program.url === 'string') {
        (function() {
          con.push(new Url(program.url))
             .append(read_index$A);
        })();
      } else if (typeof program.index === 'string') {
        con.push(Index.loadJSON(fs.readFileSync(program.index)));
      } else {
        error("no url or index file specified, abort");
      }
      con.push(program.browser, program.delay, !!program.force)
         .append(download_index$A)
         .append(quitapp)
         .fire();
    }
  });

  define_subcommand('package', {
    description: "package chapters into single epub file",
    setup: function() {
      program
        .option("\n\b\b[package]:", "")
        .option("-i, --index [dir]", "the directory contains index.json and chapters")
        .option("-o, --out [epub]", "the output epub filename");
    },
    action: function() {
      check_existstence("index");

      var fs = require("fs"),
          filename = program.index + "/index.json",
          index;

      if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        error("cannot read file: " + program.index);
      }

      index = Index.loadJSON(fs.readFileSync(filename));
      program.out = program.out || index.title() + " - " + index.author() + ".epub";
      index.package(program.index, program.out, function(bytes) {
        console.log(bytes + " bytes writen to " + program.out);
        quitapp();
      });
    }
  });

  define_subcommand('fetch', {
    description: "fetch single chapter and present its content",
    setup: function() {
      program
        .option("\n\b\b[fetch]:", "")
        .option("-u, --url [url]", "the webpage to be fetched")
        .option("-b, --browser [model]", "browser backend to use", 'auto');
    },
    action: function() {
      check_existstence("url");
      var con = new Context();
      con.push(program.url, program.browser)
         .insert(fetch_chapter$A)
         .append(function(html) {
            console.log(html);
            quitapp();
          })
         .fire();
    }
  });

  define_subcommand("info", {
    description: "display various information",
    setup: function () {
      program.option("\n\b\b[info]:", "")
             .option("-b, --browser", "list available browsers")
             .option("-s, --sites", "list available site scripts");
    },
    action: function() {
      var sema = new Semaphore();
      sema.incr();
      sema.hook(quitapp);
      if (program.browser) {
        sema.incr();
        var jsdom = require("jsdom");
        var child_process = require("child_process");
        child_process.exec("phantomjs --version", function(err, stdout) {
          console.log("Browsers:");
          if (!err) {
            console.log(" * phantomjs: " + stdout.toString().trim());
          }
          if (jsdom) {
            console.log(" * jsdom: " + jsdom.version);
          }
          console.log();
          sema.decr();
        });
      }

      if (program.sites) {
        sema.incr();
        var dirs = [];
        var genpath = function(dir) {
          var basepath = __dirname + "/../lib/sites";
          if (arguments.length === 0) {
            return basepath;
          } else {
            return basepath + '/' + dir;
          }
        };
        fs.readdirSync(genpath()).forEach(function(dir) {
          if (fs.statSync(genpath(dir)).isDirectory()) {
            dirs.push(dir);
          }
        });

        console.log("Sites:");
        dirs.forEach(function (dir) { list_scripts(genpath, [dir]); });
        console.log();
        sema.decr();
      }
      sema.decr();
    }
  });

  function forEach(obj, callback)  {
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) {
        callback(k, obj[k]);
      }
    }
  }

  program
    .version(package_json.version)
    .usage("Command [Options]");
  program._name = package_json.name;

  forEach(commands, function(k, v) {
    program.command(k).description(v.description);
  });

  if (argv.length === 2) {
    program.help();
  } else if (argv.length === 3 && (argv[2] === '-h' || argv[2] === '--help')) {
    for (var k in commands) {
      if (commands.hasOwnProperty(k)) {
        commands[k].setup();
      }
    }
    program.help();
  } else if (commands.hasOwnProperty(argv[2])) {
    (function(cmd) {
      argv = argv.slice(0, 2).concat(argv.slice(3));
      commands[cmd].setup();
      program.usage(cmd + " [Options]");

      if (argv.length === 2) {
        program.help();
      } else {
        program.parse(argv);
        commands[cmd].action(program);
      }
    })(argv[2]);
  } else if (argv.length === 3 && argv[2][0] === '-') {
    program.parse(argv);
    if (program.list) {
      var engines = require('../lib/dom').availableEngines;
      console.log([" * available dom engines are: "].concat(engines.join(', ')).join(''));
    }
    quitapp();
  } else {
    console.error("error: unknown subcommand: " + argv[2]);
    quitapp(2);
  }
} /// end of main(argv)

require('../lib/miniserver')(function(port, server) {
  global.LOCAL_MINISERVER = function(path) {
    return 'http://localhost:' + port + '/' + path;
  };
  miniserver = server;
  main(process.argv);
});

// vim: set errorformat=%f\:\ line\ %l\\,\ col\ %c\\,%m:
