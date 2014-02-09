#!/usr/bin/env node

var Url = require('./lib/Url');

var sitepart;  // the site specific module

function load_sitepart(url) {
  var domain;
  domain = (new Url(url)).getDomain();

  try {
      sitepart = require('./lib/sites/' + domain);
  } catch (err) {
      console.error('no modules found for domain: ' + domain + ',abort...');
      process.exit(3);
  }
}

/**
 * This is a wrapper of the jsdom env function, which adds proxy support
 * @param {string} url - the url to be processed
 * @param {Function} callback - prototype is function(error, window)
 */

function http_request(url, callback) {
    var http_proxy = process.env.http_proxy;

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
                    url: url.data(),
                    proxy: http_proxy,
                },
                function(error, response, html) {
                    if (!error && response.statusCode == 200) {
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

function print_index(index) {
    console.log("title:\t", index.title());
    console.log("author:\t", index.author());
    if (index.cover()) {
      console.log("cover:\t", index.cover().src);
    }
    console.log("==== Table of Contecnts ====");
    index.debugPrint(console.log);
}

function read_index(url, further_operation) {
    load_sitepart(url);
    http_request(url,
        function (errors, window) {
            further_operation(sitepart.indexer(window));
       });
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
        urlparts, filename;

    filename = (new Url(url)).getFileName();

    http_request(args.item.url, function (errors, window) {
        sitepart.extractor.call({
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
    for (var i=0; i< count; i++) { leaf_iterator(); }

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
                    if (task_count == concurrency) {
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
    var i;
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
        var count = 0;
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
    var jszip = require('jszip'),
        zip = new jszip(),
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

var help_message = (function() {
    var myname = process.argv[1].split("/");
    myname = myname[myname.length - 1];
    return "Usage: " +  myname + " [ options ]\n" +
"OPTIONS\n" +
"  -l url          fetch url (index page) and print table of contents\n" +
"  -d url          fetch url (index page) download associated pages\n" +
"  -o filename     specify output filename/dirname\n" +
"  -c n            start downloading from the nTH item\n" +
"  -n n            specify the concurrency when downloading\n" +
"  -p dir          package the downloaded files into a single epub file\n" +
"  -?|-h           print this message\n";
})();


function main(argv) {
   var Troll = require('troll-opt').Troll;

   var opts = (new Troll()).options(function(troll) {
    troll.banner('fetch net novel and package to epub.');
    troll.opt('index',
              'print table of contents and other info about book',
              { type: 'string', short: 'i' });
    troll.opt('download',
              'download book contents and index from url, use --output to specify write out directory',
              { type: 'string', short: 'd' });
    troll.opt('start',
              'start downloading from nth item',
              { default: '1', short: 's' });
    troll.opt('concurrency',
              'downloading chapters by utilizing multi-connection',
              { default: '5', short: 'n'});
    troll.opt('package',
              'package the write out directory to an epub ebook',
              { type: 'string', short: 'p'});
    troll.opt('output', 'the write out directory',
                        { type: 'string', short:'o'});
    troll.opt('fetch', 'fetch and print the chapter',
              { type: 'string'});
   });

   if (typeof(opts.download) === 'string') {
       if (typeof(opts.output) !== "string") {
            opts.output = (function() {
                function gen() {
                    return 'tmp' + Math.floor(Math.random() * 10000);
                }
                var dir, fs = require('fs');
                do { dir = gen(); } while (fs.existsSync(dir));
                fs.mkdirSync(dir);
                console.log("output to " + dir);
               return dir;
            })();
       }

       read_index(opts.download, (function (index) {
           download_index(index, opts.output,
                          parseInt(opts.start, 10),
                          parseInt(opts.concurrency, 10));
       }));
   } else if (typeof(opts.index) === 'string') {
       read_index(opts.index, print_index);
   } else if (typeof(opts.package) === 'string') {
       (function(dir) {
            var fs = require("fs"),
                filename = dir + "/index.json",
                content;
            if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
                (function(content) {
                    var index, out_filename, Index = require('./lib/Index');
                    index = Index.loadJSON(content);
                    if (typeof(opts.output) === 'string') {
                        out_filename = opts.output;
                    }
                    package_epub(index, dir, out_filename);
                })(fs.readFileSync(filename));
            }
       })(opts.package);
   } else if (typeof(opts.fetch) === 'string') {
       load_sitepart(opts.fetch);
       fetch_chapter({
           item: {url : opts.fetch, name: "test page"},
           chain_func : function(html) { console.log(html);}
       });
   } else {
       console.error("wrong arguments");
       process.exit(1);
   }
}

main(process.argv);
