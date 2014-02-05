#!/usr/bin/env node

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
                    url: url,
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

/**
 *  parse command line arguments and return a hash looks like:
 *  {"-?": undefined, "-o": "/root/home/xxx/out" }
 *  @param {object} args
 */
function getopt(args) {
    var set = {};

    function is_option(str) {
        if (str.length === 2 && str[0] === '-') {
            return true;
        } else {
            return false;
        }
    }

    (function filter_option(index) {
        var arg;
        for (; index < args.length; index++) {
            arg = args[index];
            if (is_option(arg)) {
                if (index + 1 < args.length && !is_option(args[index+1])) {
                   set[arg] = args[++index];
                } else {
                   set[arg] = null;
                }
            }
        }
    })(0);

    return set;
}

function print_index(index) {
    console.log("title:\t", index.title);
    console.log("author:\t", index.author);
    console.log("cover:\t", index.cover.src);
    console.log("==== Table of Contecnts ====");
    index.toc.forEach(function (item) {
        console.log(item.name, " => ", item.url);
    });
}

function read_index(url, further_operation) {
    http_request(url,
        function (errors, window) {
            function extractNovelInfo(parentNode) {
                var rc = {};
                var pat = /^\s*(.+):(.+)$/;
                for (var c = parentNode.firstChild; c !== null; c = c.nextSibling) {
                    if (c.nodeType === window.Node.TEXT_NODE) {
                        var tmp = pat.exec(c.data);
                        if (tmp !== null) {
                            var key = tmp[1];
                            var value = tmp[2];
                            switch (key) {
                                case "作者":
                                    rc.author = value; break;
                                case "状态":
                                    rc.status = value; break;
                                case "简介":
                                    rc.brief = value; break;
                            }
                        }
                    }
                }
                return rc;
            }

            function get_toc(toc) {
                var rc = [];
                var list = toc.getElementsByClassName("zl");
                for (var i = 0; i < list.length; i++) {
                    var li = list[i];
                    var a = li.firstChild;
                    var text = a.firstChild.data;
                    var link = a.href;
                    rc.push({name: text, url: link});
                }
                return rc;
            }

            var document = window.document;
            var tit = document.getElementsByClassName("tit")[0];
            var header = extractNovelInfo(tit.parentNode);
            var index = {
                "title": tit.firstChild.firstChild.data,
                "cover": (function(brother) { // search for img
                    for (var x = brother.nextSibling; x; x = x.nextSibling) {
                        if (x.nodeType === window.Node.ELEMENT_NODE &&
                            x.tagName === 'IMG')
                            return {src: x.src, width: x.width, height: x.height};
                    }
                })(tit),
                "author": header.author,
                "toc": get_toc(document.getElementsByClassName("tit")[1]
                    .parentNode.children[1])
            };
            window.close();
            further_operation(index);
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
    var item = args.item,
        dest = args.dest,
        chain_func = args.chain_func,
        i;

    http_request(
        item.url,
        function (errors, window) {
            function removeNode(node) {
                node.parentNode.removeChild(node);
            }
            function removeNodes(nodes) {
                var to_delete = [];
                for (i = 0; i < nodes.length; i++) {
                    to_delete.push(nodes[i]);
                }
                for (i = 0; i < to_delete.length; i++) {
                    removeNode(to_delete[i]);
                }
            }

            var document = window.document;
            var content = document.getElementById("content");
            removeNodes(content.getElementsByTagName("script"));
            removeNodes(content.getElementsByClassName("bad"));
            removeNode(content.lastChild);
            removeNode(content.lastChild);
            removeNode(content.lastChild);
            removeNode(content.lastChild);

            removeNodes(content.querySelectorAll("img"));

            var html = [
        '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"',
        '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
        '<html xmlns="http://www.w3.org/1999/xhtml">',
        '<head>',
        '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
        '<title>',
        item.name,
        '</title></head>',
        '</head>',
        '<body>',
        content.innerHTML,
        '</body></html>'].join("");
            if (!dest) {
                console.log(html);
            } else {
                (function() {
                    var filename;
                    var url = decodeURI(item.url);
                    var buffer = [];

                    if (url[url.length-1] == '/') {
                        url = url.slice(0, url.length - 1);
                    }
                    for (var i = url.length - 1; i >= 0; i--) {
                        if (url[i] !== '/') {
                            buffer.push(url[i]);
                        } else {
                            filename = buffer.reverse().join("");
                            break;
                        }
                    }
                    chain_func(html, filename, args);
                })();
            }
        });
}

function download_index(index, dir, start, concurrency, chain_func) {
    var count = -1,
        toc = index.toc,
        length = toc.length,
        i,
        fetch_nexts = [],
        task_count = -2,
        fs = require("fs"),
        request = require("request"),
        proxy = process.env.http_proxy;

    if (!chain_func) { chain_func = function() {} };

    if (start) {
        count += (start - 1);
        if (!concurrency || concurrency < 1) {
            concurrency = 5;
        }
    }

    fs.writeFile(dir + "/index.json", JSON.stringify(index), function() {
        console.log("write index.json");
    });
    (function() {
        var req = request({url: index.cover.src, proxy: proxy });
        var out = fs.createWriteStream(dir + "/cover.jpg");
        req.pipe(out);
        req.on("end", function() { console.log("write cover.jpg"); });
    })();

    for (i=0; i < concurrency; i++) {
        fetch_nexts[i] = (function() {
            var index = i;
            var args = {
                generator : function() {return toc[++count];},
                dest: dir,
                chain_func : function(html, filename, args) {
                    save_chapter(html, args.dest, filename);
                    fetch_nexts[index]();
                }
            };

            return function() {
                args.item = args.generator();
                if (args.item) {
                    console.log("fetch ", count+1, '/', length,
                                " : ", args.item.name);
                    fetch_chapter(args);
                } else {
                    task_count += 1;
                    if (task_count == concurrency) { chain_func(); }
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
    a('    <text>' + index.title + " -- " +  index.author + '</text>');
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
    a('   <dc:creator opf:role="aut">' + index.author + '</dc:creator>');
    a('   <dc:language>zh-CN</dc:language>');
    a('   <dc:title>' + index.title+ '</dc:title>');
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
            var parts = url.split("/");
            return parts[parts.length-1];
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
    index.toc.forEach(function(item) {
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
    function a(str) { content.push(str); };
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
    a('                <image width="' + index.cover.width +
                        '" height="' + index.cover.height + '" xlink:href="cover.jpg"/>');
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

    if (!output) { output = index.title + ".epub"; }

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


function main(options) {
   if (process.argv.length == 2 || options["-h"] || options["-?"]) {
       console.log(help_message);
   } else if (options["-l"]) { // list toc and header info
       read_index(options["-l"], print_index);
   } else if (options["-d"]) { // download chapters
       if (options["-o"]) {
            (function (dir) {
                var fs = require("fs"),
                    stat = fs.statSync(dir),
                    begin = 1,
                    concurrency;

                if (options["-c"]) {
                    begin = parseInt(options["-c"], 10);
                }
                if (options["-n"]) {
                    concurrency = parseInt(options["-n"], 10);
                }
                if (stat.isDirectory()) {
                    read_index(options["-d"], (function (index) {
                        download_index(index, dir, begin, concurrency);
                    }));
                } else {
                    console.error(dir, "is not a directory");
                }
            })(options["-o"]);
       } else {
            console.error("the output directory must be specified by -o");
       }
   } else if (options["-p"]) {
       (function(dir) {
            var fs = require("fs"),
                filename = dir + "/index.json",
                content;
            if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
                (function(content) {
                    var index = JSON.parse(content),
                        out_filename;
                    if (options["-o"]) {
                        out_filename = options["-o"];
                    }
                    package_epub(index, dir, out_filename);
                })(fs.readFileSync(filename));
            }
       })(options["-p"]);
   } else if (options["-f"]) { // fetch and print chapter
       fetch_chapter({"item": {"url" : options["-f"], "name": "test page"}});
   } else if (options["-F"]) { // download chapter
       fetch_chapter({"item":{"url": options["-F"], "name": "test page"}},
               ".",
               save_chapter);
   } else {
       console.error("wrong arguments");
   }
}

main(getopt(process.argv));
