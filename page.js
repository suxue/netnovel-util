#!/usr/bin/env node

var myconfig = {features: false}
if (process.env["http_proxy"]) {
    myconfig.http_proxy = process.env.http_proxy
}

function getopt(args) {
    var set = {}

    function is_option(str) {
        if (str.length === 2 && str[0] === '-') {
            return true
        } else {
            return false
        }
    }

    (function filter_option(index) {
        var arg
        for (; index < args.length; index++) {
            arg = args[index]
            if (is_option(arg)) {
                if (index + 1 < args.length && !is_option(args[index+1])) {
                   set[arg] = args[++index]
                } else {
                   set[arg] = null
                }
            }
        }
    })(0)

    return set
}

function print_index(index) {
    console.log("title:\t", index.title)
    console.log("author:\t", index.author)
    console.log("cover:\t", index.cover)
    console.log("==== Table of Contecnts ====")
    index.toc.forEach(function (item) {
        console.log(item.name, " => ", item.url)
    })
}

function read_index(url, further_operation) {
    require("jsdom").env(
        url,
        myconfig,
        function (errors, window) {
            function extractNovelInfo(parentNode) {
                var rc = {}
                var pat = /^ (.+):(.+)$/
                for (var c = parentNode.firstChild; c !== null; c = c.nextSibling) {
                    if (c.nodeType === window.Node.TEXT_NODE) {
                        var tmp = pat.exec(c.data)
                        if (tmp !== null) {
                            var key = tmp[1]
                            var value = tmp[2]
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
                return rc
            }

            function get_toc(toc) {
                var rc = []
                var list = toc.getElementsByClassName("zl")
                for (var i = 0; i < list.length; i++) {
                    var li = list[i]
                    var a = li.firstChild
                    var text = a.firstChild.data
                    var link = a.href
                    rc.push({name: text, url: link})
                }
                return rc
            }

            var document = window.document
            var tit = document.getElementsByClassName("tit")[0]
            var header = extractNovelInfo(tit.parentNode)
            var index = {
                "title": tit.firstChild.firstChild.data,
                "cover": tit.nextSibling.src,
                "author": header.author,
                "toc": get_toc(document.getElementsByClassName("tit")[1]
                    .parentNode.children[1])
            }
            window.close();
            further_operation(index)
       })
}

function save_chapter(html, destdir, filename) {
    var fs = require("fs")
    if (destdir[destdir.length - 1] !== '/') {
        destdir = destdir + '/'
    }
    fs.writeFileSync(destdir + filename, html)
}

function fetch_chapter(args) {
    var item = args.item
    var dest = args.dest
    var chain_func = args.chain_func
    require("jsdom").env(
        item.url,
        myconfig,
        function (errors, window) {
            function removeNode(node) {
                node.parentNode.removeChild(node)
            }
            function removeNodes(nodes) {
                var to_delete = []
                for (var i = 0; i < nodes.length; i++) {
                    to_delete.push(nodes[i])
                }
                for (var i = 0; i < to_delete.length; i++) {
                    removeNode(to_delete[i])
                }
            }

            var document = window.document
            var content = document.getElementById("content")
            removeNodes(content.getElementsByTagName("script"))
            removeNodes(content.getElementsByClassName("bad"))
            removeNode(content.lastChild)
            removeNode(content.lastChild)
            removeNode(content.lastChild)
            removeNode(content.lastChild)

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
        '</body></html>'].join("")
            if (!dest) {
                console.log(html)
            } else {
                (function() {
                    var filename
                    var url = decodeURI(item.url)
                    var buffer = []

                    if (url[url.length-1] == '/') {
                        url = url.slice(0, url.length - 1)
                    }
                    for (var i = url.length - 1; i >= 0; i--) {
                        if (url[i] !== '/') {
                            buffer.push(url[i])
                        } else {
                            break
                        }
                    }
                    chain_func(html, buffer.reverse().join(""), args)
                })();
            }
        })
}

function download_index(index, dir, start) {
    var count = -1
    var toc = index.toc
    var length = toc.length

    if (start) {
        count +=  (start - 1)
    }

    var generator = function() {
       return toc[++count]
    }
    var args = {
        "generator": generator,
        "dest": dir,
    }

    function chain_func(html, filename, args) {
        save_chapter(html, args.dest, filename)
        args.item = generator()
        if (args.item) {
           console.log("fetch ", count+1, '/', length, " : ", args.item.name)
           fetch_chapter(args)
        }
    }
    args.chain_func = chain_func
    args.item = generator()
    console.log("fetch ", count+1, '/', length, " : ", args.item.name)
    fetch_chapter(args)
}

(function main() {
   var options = getopt(process.argv)
   if (options["-l"]) { // list toc and header info
       read_index(options["-l"], print_index)
   } else if (options["-d"]) { // download chapters
       if (options["-o"]) {
            (function (dir) {
                var fs = require("fs")
                var stat = fs.statSync(dir)
                var begin = 1
                if (options["-c"]) {
                    begin = parseInt(options["-c"], 10)
                }
                if (stat.isDirectory()) {
                    read_index(options["-d"], (function (index) {
                        download_index(index, dir, begin)
                    }))
                } else {
                    console.error(dir, "is not a directory")
                }
            })(options["-o"])
       } else {
            console.error("the output directory must be specified by -o")
       }
   } else if (options["-f"]) { // fetch and print chapter
       fetch_chapter({"item": {"url" : options["-f"], "name": "test page"}})
   } else if (options["-F"]) { // download chapter
       fetch_chapter({"item":{"url": options["-F"], "name": "test page"}},
               ".",
               save_chapter)
   } else {
       console.error("wrong arguments")
   }
})()
