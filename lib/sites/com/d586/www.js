/*jslint browser: true */

exports.encoding = "gbk";
exports.engine = "jsdom";

var cover_pattern = /^http:\/\/www\.d586\.com\/txt_(\d+)\/?$/;
var toc_pattern = /^http:\/\/www\.d586\.com\/du_(\d+)\/?$/;


exports.indexer = function(index) {
  var window = this;
  var document = window.document;

  function toc_indexer(index) {

    index.title = document.querySelector("section.ml_title h1").textContent;
    index.author = document.querySelector("section.ml_title span a").textContent;
    var tocbox = document.querySelector("section.ml_main").querySelector("dl");
    var toc = [];
    index.toc = toc;
    var section;
    var link;

    var c = tocbox.firstChild;
    while (c) {
      if (c.nodeType === window.Node.ELEMENT_NODE) {
        if (c.tagName === "DT") {
          // new section
          section = {name: c.textContent, toc:[]};
          toc.push(section);
        } else if (c.tagName === "DD") {
          // articles
          if (section) {
            link = c.querySelector("a");
            section.toc.push([link.textContent, link.href]);
          }
        }
      }
      c = c.nextSibling;
    }

    if (index.coverUrl) {
      delete index.url;
    } else {
      index.url = document.body.
        querySelector("section.ml_title div.title div.ml_gj a.two").href;
    }
    return index;
  }

  function cover_indexer(index) {
    var cover = document.querySelector("img.cover");
    index.coverUrl = cover.src;
    index.coverWidth = cover.width;
    index.coverHeight = cover.height;

    var brief = document.querySelector("div.descriptions");
    var links = brief.querySelectorAll("a");
    var strong = brief.querySelector("strong");
    for (var i=0; i < links.length; i++) {
      brief.removeChild(links[i]);
    }
    brief.removeChild(strong);
    index.brief = brief.textContent;

    if (index.author) {
      delete index.url;
    } else {
      index.url = document.querySelector("a#read_book").href;
    }
    return index;
  }

  var url = index.url;
  var rc;
  rc = cover_pattern.test(url);
  if (rc) {
    return cover_indexer(index);
  }
  rc = toc_pattern.test(url);
  if (rc) {
    return toc_indexer(index);
  }
  throw new TypeError(url + " is not a valid d586 book url");
};

exports.extractor = function() {
  var window = this;
  var document = window.document;
  var text = document.querySelector("div.yd_text2");
  var ads = text.querySelectorAll(".yd_ad4");
  var links = text.querySelectorAll("a");

  for (var i=0; i < ads.length; i++) {
    ads[i].parentNode.removeChild(ads[i]);
  }

  for (i=0; i < links.length; i++) {
    links[i].parentNode.removeChild(links[i]);
  }
  var node = text.lastChild;
  var todelete = [];
  var con;
  while (node && todelete.length < 5) {
    if (node.nodeType === window.Node.TEXT_NODE) {
      con = node.textContent;
      if (/感谢各位书友的支持/.test(con) ||
          /D586.COM免费为广大书友/.test(con) ||
          /光临阅读，最新、最快/.test(con) ||
          /手机用户请到m\.阅/.test(con)) {
        todelete.push(node);
      }
    } else if (node.nodeType === window.Node.COMMENT_NODE) {
      todelete.push(node);
    }
    node = node.previousSibling;
  }
  for (i=0; i < todelete.length; i++) {
    text.removeChild(todelete[i]);
  }


  var title = document.querySelector(".ydleft").querySelector("h2");

  return {
    title: title.textContent,
    body: text.innerHTML
  };
};
