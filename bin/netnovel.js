var fs = require("fs");

var Context  = require('../lib/Context');
var Semaphore = require('../lib/Semaphore');
var Index = require('../lib/Index');
var Url = require('../lib/Url');
var assert = require('../lib/assert');
var request = require('../lib/request');

(function(){
// setup fallback error reporting
//
  Error.stackTraceLimit = Infinity;
  process.on('uncaughtException', function(err) {
    if (typeof err === 'object' && typeof err.name === 'string') {
      if (err.message) {
        console.log('\nMessage: ' + err.message);
      }
      console.log(err.stack);
    } else {
      console.log('dumpError :: argument is not an object');
    }
    process.exit(99);
  });
})();

function save_index$A(filename, index) {
  assert(typeof filename === 'string');
  assert(index instanceof Index);
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
  });
}

/////
//    FuncName$A means this function is meant to be used as part of
//    an asynchronize calling chain and its input parameters should be
//    filled by its caller
////
function print_index$A(index) {
  assert(index instanceof Index);

  console.log("title:\t", index.title());
  console.log("author:\t", index.author());
  console.log("brief:\t", index.brief());
  if (index.cover()) {
    console.log("cover:\t", index.cover().src);
  }
  console.log("==== Table of Contents ====");
  index.debugPrint(console.log);
}

function read_index$A(url) {
  assert(url instanceof Url);
  /////////////////////////////////
  var index = new Index();
  index.href(url.data());
  var dom = require("../lib/dom")(url.getDomain(), 'index');

  function repeater$A(top) {
    if (top instanceof Index) {
      console.log('finish');
      this.pop();
      this.yield(top);
    } else if (top instanceof Url) {
      this.insert(
        function() {
          var context = this;
          var job = dom(top, function(r) { context.yield(r); });
          job.setWorkerExtraArgs(top, index);
          job.run();
        },
        repeater$A
      ).yield();
    } else {
      throw new TypeError();
    }
  }

  this.insert(repeater$A).yield(/*delimiter*/null, url);
}


function fetch_chapter$A(urlstr) {
  assert(typeof urlstr === 'string');
  var url = new Url(urlstr);
  ///////////////////////////////////////////////////

  var context = this;
  var dom = require('../lib/dom')(url.getDomain(), 'extract');
  dom(url, function(html) {
    context.yield(html);
    this.yield();
  }).run();
}

function download_index$A(config, index) {
  assert(typeof config  === 'object');
  assert(index instanceof Index);

  var length = index.getStatistics().leafCount;
  var sema = new Semaphore();
  var count = config.start;
  var i;

  sema.hook(function() {
    console.log('\n  fetching complete, writen out to: ' + config.outdir);
  });

  // write index.json
  sema.incr();
  fs.writeFile(config.outdir + "/index.json", index.toJSON(), function() {
    console.log("write index.json");
    sema.decr();
  });

  // fetch cover picture
  if (index.cover()) {
    sema.incr();
    (function() {
      var con = new Context();
      con.set(
        // set encoding to null to get binary response(node Buffer)
        request({url: index.cover().src, encoding: null}),
        function (data) {
          var body = data.body;
          fs.writeFileSync(config.outdir + "/cover.jpg", body);
          console.log("write cover.jpg");
          sema.decr();
        }
      ).fire();
    })();
  }

  // skip n items to reeach start point
  var item_generator = index.getLeafIterator();
  for (i = 1; i < config.start; i++) { item_generator(); }

  var href = index.href();
  var url = new Url(href);
  var dom = require('../lib/dom')(url.getDomain(), 'extract');
  function generator() {
    var item = item_generator();
    if (!item) {
      return undefined;
    }

    var href = item.url;
    var url = new Url(decodeURI(href));
    var name = item.name;
    return [
      url,
      function(html) {
        var filename = url.getFileName();
        sema.incr();
        fs.writeFile(config.outdir + "/" + filename, html, function() {
          console.log("fetch ", count++, '/', length, " : ", name);
          sema.decr();
        });
        this.yield();
      }
    ];
  }

  for (i=0; i < config.concurrency; i++) {
    sema.incr();
    dom(generator).onEnd(function() {sema.decr(); }).run();
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

  function error(msg) {
    console.error("error: " + program._name +  ": " + msg);
    process.exit(1);
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
    },
    action: function() {
      var con = new Context();

      if (program.url !== undefined) {
        con.push(new Url(program.url))
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
        .option("-s, --start [pos]", "the start point (1-based) of downloading", "1")
        .option("-n, --concurrency [num]", "establish [num] connections concurrently", "5");
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
      con.append(download_index$A)
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
      index.package(program.index, program.out);
    }
  });

  define_subcommand('fetch', {
    description: "fetch single chapter and present its content",
    setup: function() {
      program
        .option("\n\b\b[fetch]:", "")
        .option("-u, --url [url]", "the webpage to be fetched");
    },
    action: function() {
      check_existstence("url");
      var con = new Context();
      con.push(program.url)
         .insert(fetch_chapter$A)
         .append(function(html) {
            console.log(html);
          })
         .fire();
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
  } else {
    console.error("error: unknown subcommand: " + argv[2]);
  }
} /// end of main(argv)

main(process.argv);

// vim: set errorformat=%f\:\ line\ %l\\,\ col\ %c\\,%m:
