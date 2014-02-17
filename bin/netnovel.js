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

function package_META_INF(index, zip) {
  var filename = "META-INF/container.xml";
  zip.file(filename, new Buffer(
    '<?xml version="1.0"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      '  <rootfiles>\n' +
      '    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>\n' +
      '  </rootfiles>\n</container>'));
}

function package_mimetype(index, zip) {
  var filename = "mimetype";
  zip.file(filename, new Buffer("application/epub+zip"));
}

function package_ncx(index, ncx, zip) {
  var content = [];
  var count = 0;
  function a(str) { content.push(str); }

  a("<?xml version='1.0' encoding='utf-8'?>");
  a('<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">');
  a('  <head>');
  a('    <meta content="ce9a2d4a-3b43-4cb9-aa35-3b01571d336d" name="dtb:uid"/>');
  a('    <meta content="2" name="dtb:depth"/>');
  a('    <meta content="calibre (0.9.3)" name="dtb:generator"/>');
  a('    <meta content="0" name="dtb:totalPageCount"/>');
  a('    <meta content="0" name="dtb:maxPageNumber"/>');
  a('  </head>');
  a('  <docTitle>');
  a('    <text>' + index.title() + " -- " +  index.author() + '</text>');
  a('  </docTitle>');
  a('  <navMap>');

  ncx.forEach(function(item) {
    a('    <navPoint class="chapter" id="' + item.id + '" playOrder="' + (++count) + '">');
    a('      <navLabel>');
    a('        <text>'+ item.text + '</text>');
    a('      </navLabel>');
    a('      <content src="'+ item.src + '"/>');
    a('    </navPoint>');
  });
  a('  </navMap>');
  a('</ncx>');
  zip.file("toc.ncx", new Buffer(content.join('\n')));
}

function package_content_opf(index, zip) {
  var content = [];
  var spine = [];
  var add_chapter;
  var base_dir = "feed_0";
  var ncx = [];

  function a(str) { content.push(str); }

  a('<?xml version="1.0"  encoding="UTF-8"?>');
  a('<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uuid_id">');
  a('  <metadata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:calibre="http://calibre.kovidgoyal.net/2009/metadata" xmlns:dc="http://purl.org/dc/elements/1.1/">');
  a('   <meta name="cover" content="cover"/>');
  a('   <dc:creator opf:role="aut">' + index.author() + '</dc:creator>');
  a('   <dc:language>zh-CN</dc:language>');
  a('   <dc:title>' + index.title() + '</dc:title>');
  a('   <dc:date>' + (new Date()).toISOString() + '</dc:date>');
  a('  </metadata>');

  // start building manifest
  a('  <manifest>');

  // add cover
  a('   <item href="cover.jpg" id="cover" media-type="image/jpeg"/>');
  zip.includeLocalFile("cover.jpg", "cover.jpg");

  // title page
  a('   <item href="titlepage.xhtml" id="titlepage" media-type="application/xhtml+xml"/>');

  a('   <item href="toc.ncx" media-type="application/x-dtbncx+xml" id="ncx"/>');
  spine.push('<spine toc="ncx">');
  spine.push('<itemref idref="titlepage"/>');

  // add chapters
  add_chapter = (function () {
    var count = 0, Url = require('../lib/Url');
    function get_filename(url) {
      return (new Url(url)).getFileName();
    }

    return function(item) {
      var url = item.url;
      var filename = get_filename(url);
      var manifest_name = base_dir + "/" + filename;
      a('   <item href="' + manifest_name  +
        '" id="html' + (++count) + '" ' +
        'media-type="application/xhtml+xml"/>');
      spine.push('<itemref idref="html' + count + '"/>');
      zip.includeLocalFile(filename, manifest_name);
      ncx.push({id: "html" + count, src : manifest_name, text: item.name });
    };
  })();
  index.forEachLeaf(function(item) {
    add_chapter(item);
  });
  a('  </manifest>');
  spine.push('</spine>');
  a(spine.join('\n'));
  a('</package>');
  zip.file("content.opf", new Buffer(content.join("\n")));
  package_ncx(index, ncx, zip);
}

function package_title_page(index, zip) {
  var content = [];
  function a(str) { content.push(str); }
  a("<?xml version='1.0' encoding='utf-8'?>");
  a('<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">');
  a('    <head>');
  a('        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>');
  a('        <title>Cover</title>');
  a('        <style type="text/css" title="override_css">');
  a('            @page {padding: 0pt; margin:0pt}');
  a('            body { text-align: center; padding:0pt; margin: 0pt; }');
  a('        </style>');
  a('    </head>');
  a('    <body>');
  a('        <div>');
  a('            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 200 160" preserveAspectRatio="none">');
  a('                <image width="' + index.cover().width +
    '" height="' + index.cover().height + '" xlink:href="cover.jpg"/>');
  a('            </svg>');
  a('        </div>');
  a('    </body>');
  a('</html>');
  zip.file("titlepage.xhtml", new Buffer(content.join("\n")));
}

/**
 * package html source files in dir to a single epub file
 * @param {object} index - the index object
 * @param {string} dir   - directory contains source html files
 * @param {string} output - output file name
 */
function package_epub(index, dir, output) {
  var Jszip = require('jszip'),
      zip = new Jszip(),
      fs = require("fs");

  if (!output) { output = index.title() + ".epub"; }

  zip.includeLocalFile = function(externalFile, manifestName) {
    var buffer = new Buffer(fs.readFileSync(dir + "/" + externalFile));
    zip.file(manifestName, buffer);
  };

  package_mimetype(index, zip);
  package_META_INF(index, zip);
  package_content_opf(index, zip);
  package_title_page(index, zip);

  fs.writeFileSync(output, zip.generate({type: "nodebuffer",
                                         compression: "DEFLATE" }));
  console.log("write " + output);
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
          //read_index(program.url, (function (index) {
            //download_index(index, program.out,
                           //parseInt(program.start, 10),
                           //parseInt(program.concurrency, 10));
          //}));
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
      package_epub(index, program.index, program.out);
    }
  });

  define_subcommand('fetch', {
    description: "fetch single chapter and present its content",
    setup: function() {
      program.option("-u, --url [url]", "the webpage to be fetched");
    },
    action: function() {
      check_existstence("url");
      fetch_chapter({
        item: {url : program.url, name: "test page"},
        chain_func : function(html) { console.log(html);}
      });
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
