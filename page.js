#!/usr/bin/env node

/**
 * This is a wrapper of the jsdom env function, which adds proxy support
 * @parma {string} url - the url to be processed
 * @parma {function} callback - prototype is function(error, window)
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
 *  @parma {object} args
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
    console.log("cover:\t", index.cover);
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
                            return x;
                    }
                })(tit).src,
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

function download_index(index, dir, start, concurrency) {
    var count = -1,
        toc = index.toc,
        length = toc.length,
        i,
        fetch_nexts = [];

    if (start) {
        count += (start - 1);
        if (!concurrency || concurrency < 1) {
            concurrency = 5;
        }
    }

    console.log("write index.json");
    require("fs").writeFileSync(dir + "/index.json", JSON.stringify(index));

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
                }
            };
        })();
    }

    fetch_nexts.forEach(function (c) { c(); });
}

function main(options) {
   if (options["-l"]) { // list toc and header info
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
