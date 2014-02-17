var assert = require('../lib/assert');

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
});

function print_index() {
  var index = this.pop();
  console.log("title:\t", index.title());
  console.log("author:\t", index.author());
  if (index.cover()) {
    console.log("cover:\t", index.cover().src);
  }
  console.log("==== Table of Contecnts ====");
  index.debugPrint(console.log);
}

function read_index() {
  var Url = require('../lib/Url');
  var url = this.pop();
  assert(url instanceof Url);

  this.insertCallback(
    require('../lib/request').parse_dom(url.data()),
    url.getScript().indexer
  );
  this.yield();
}


function fetch_chapter() {
  var url = this.pop();
  var request = require('../lib/request');

  function extrator() {
    var Url = require('../lib/Url');
    var dom = this.pop();
    var window = dom.window;
    var worker = (new Url(url)).getScript().extractor;

    this.exec(worker, window);
  }

  this.insertCallback(
    request.parse_dom(url),
    extrator
  ).yield();
}

function download_index() {
  var Counter = require('../lib/Counter');
  var Context = require('../lib/Context');
  var request = require("../lib/request");
  var fs = require("fs");
  var index = this.pop();
  var config = this.pop();
  var length = index.getStatistics().leafCount;
  var counter = new Counter();
  var count = config.start;
  var i;

  counter.setHook(function() {
    console.log('\n  fetching complete, writen out to: ' + config.outdir);
  });

  // write index.json
  counter.up();
  fs.writeFile(config.outdir + "/index.json", index.toJSON(), function() {
    console.log("write index.json");
    counter.down();
  });

  // fetch cover picture
  if (index.cover()) {
    counter.up();
    (function() {
      var con = new Context();
      con.setCallback(
        // set encoding to null to get binary response(node Buffer)
        request({url: index.cover().src, encoding: null}),
        function () {
          var body = this.pop().body;
          fs.writeFileSync(config.outdir + "/cover.jpg", body);
          console.log("write cover.jpg");
          counter.down();
        }
      ).fire();
    })();
  }

  var item_generator = index.getLeafIterator();
  for (i = 1; i < config.start; i++) { item_generator(); }

  function save_chapter() {
    var html = this.pop();
    var dir = this.pop();
    var url = this.pop();
    var Url = require('../lib/Url');
    var fs = require("fs");
    var filename = (new Url(url)).getFileName();
    fs.writeFileSync(dir + filename, html);
    this.yield();
  }

  function reporter() {
    var name = this.pop();
    console.log("fetch ", count++, '/', length,
                " : ", name);
    this.yield();
  }

  var proc_generator = function() {
    var item = item_generator();
    if (item) {
      return function() {
        this.push(item.name, item.url, config.outdir, item.url);
        this.insertCallback(
          fetch_chapter,
          save_chapter,
          reporter
        ).yield();
      };
    }
  };

  function new_task() {
    counter.up();
    var context = new Context();
    context.setGenerator(proc_generator)
           .appendCallback(function() { counter.down(); });
    return context;
  }
  for (i=0; i < config.concurrency; i++) { new_task().fire(); }
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
    console.error("error: " + program._name + " " + this.name +  ": " + msg);
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
      program.option("-u, --url [url]", "the url to be indexed");
    },
    action: function() {
      var Context = require('../lib/Context');
      var con = new Context();
      var Url = require('../lib/Url');
      con.push(new Url(program.url))
         .appendCallback(read_index)
         .appendCallback(print_index)
         .fire();
    },
  });

  define_subcommand('download', {
    description: "download chapters from index",
    setup: function() {
      program
        .option("-u, --url [url]", "the url of index")
        .option("-o, --out [dir]", "the target directory of fetched files")
        .option("-s, --start [pos]", "the start point (1-based) of downloading", "1")
        .option("-n, --concurrency [num]", "establish [num] connections concurrently", "5");
    },
    action: function() {
      var fs = require("fs"),
          stat;

      check_existstence("out");
      check_existstence("url");
      if (!fs.existsSync(program.out)) {
        error("folder " + program.out + " does not exist");
      } else {
        stat = fs.statSync(program.out);
        if (!stat.isDirectory()) {
          error(program.out + " is not a directory");
        } else {
          (function() {
            var Context = require('../lib/Context');
            var Url = require('../lib/Url');
            var con = new Context();
            var config = {
              start: parseInt(program.start, 10),
              concurrency: parseInt(program.concurrency, 10),
              outdir: program.out
            };
            con.push(config)
               .push(new Url(program.url))
               .appendCallback(read_index)
               .appendCallback(download_index)
               .fire();
          })();
        }
      }
    }
  });

  define_subcommand('package', {
    description: "package chapters into single epub file",
    setup: function() {
      program
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

      index = require('../lib/Index').loadJSON(fs.readFileSync(filename));
      index.package(program.index, program.out);
    }
  });

  define_subcommand('fetch', {
    description: "fetch single chapter and present its content",
    setup: function() {
      program.option("-u, --url [url]", "the webpage to be fetched");
    },
    action: function() {
      check_existstence("url");
      var Context = require('../lib/Context');
      var con = new Context();
      con.push(program.url)
         .insertCallback(fetch_chapter)
         .appendCallback(function() {
            var html = this.pop();
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
