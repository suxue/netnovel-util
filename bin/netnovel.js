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

/**
 * This is a wrapper of the jsdom env function, which adds proxy support
 * @param {string} url - the url to be processed
 * @param {Function} callback - prototype is function(error, window)
 */

function http_request(url, callback) {
  var http_proxy = process.env.http_proxy,
      Url = require('../lib/Url');

  function parse_dom(input) {
    require("jsdom").env(input,  {features: false} , callback);
  }

  if (!/^http:/.test(url)) {
    url = "http://" + url;
  }
  if (http_proxy) {
    (function () {
      require('request')(
        {
          url: (new Url(url)).data(),
          proxy: http_proxy,
        },
        function(error, response, html) {
          if (!error && response.statusCode === 200) {
            parse_dom(html);
          } else {
            throw error;
          }
        });
    })();
  } else {
    parse_dom(url);
  }
}

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

function save_chapter(html, destdir, filename) {
  var fs = require("fs");
  if (destdir[destdir.length - 1] !== '/') {
    destdir = destdir + '/';
  }
  fs.writeFileSync(destdir + filename, html);
}

function fetch_chapter(args) {
  var url = args.item.url,
      Url = require('../lib/Url'),
      filename;

  filename = (new Url(url)).getFileName();

  http_request(args.item.url, function (errors, window) {
    (new Url(args.item.url)).getScript().extractor.call({
      yield: function(html) { args.chain_func(html, filename, args);}
    }, window, args.item);
  });
}

function download_index(index, dir, start, concurrency, chain_func) {
  var count = 0,
      length = index.getStatistics().leafCount,
      i,
      fetch_nexts = [],
      task_count = -1,
      fs = require("fs"),
      request = require("request"),
      proxy = process.env.http_proxy,
      leaf_iterator = index.getLeafIterator();

  if (!chain_func) { chain_func = function() {}; }

  if (start) {
    count += (start - 1);
    if (!concurrency || concurrency < 1) {
      concurrency = 5;
    }
  }
  for (i=0; i< count; i++) { leaf_iterator(); }

  // write index.json
  fs.writeFile(dir + "/index.json", index.toJSON(), function() {
    task_count += 1;
    console.log("write index.json");
  });

  // fetch cover picture
  if (index.cover()) {
    task_count -= 1;
    (function() {
      var req = request({url: index.cover().src, proxy: proxy });
      var out = fs.createWriteStream(dir + "/cover.jpg");
      req.pipe(out);
      req.on("end", function() {
        console.log("write cover.jpg");
        task_count += 1;
      });
    })();
  }

  for (i=0; i < concurrency; i++) {
    fetch_nexts[i] = (function() {
      var _i = i;
      var args = {
        generator : function() { count++; return leaf_iterator(); },
        dest: dir,
        chain_func : function(html, filename, args) {
          save_chapter(html, args.dest, filename);
          fetch_nexts[_i]();
        }
      };

      return function() {
        args.item = args.generator();
        if (args.item) {
          console.log("fetch ", count, '/', length,
                      " : ", args.item.name);
          fetch_chapter(args);
        } else {
          task_count += 1;
          if (task_count === concurrency) {
            console.log('\n  fetching complete, writen out to: ' + dir);
            chain_func();
          }
        }
      };
    })();
  }

  fetch_nexts.forEach(function (c) { c(); });
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
          read_index(program.url, (function (index) {
            download_index(index, program.out,
                           parseInt(program.start, 10),
                           parseInt(program.concurrency, 10));
          }));
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
