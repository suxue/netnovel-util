/*jslint jquery: true, browser: true */

exports.scripts = ["jquery-2.0.1.min.js"];

exports.name = "一起看(17K)";

function toc_indexer(bookid, index, window) {
  var $ = window.$;
  index.title = index.title || $(".directory_title h1 a").text();
  index.author = index.author || $(".directory_title span a").text();
  var chapters = $(".tit");
  index.toc = [];
  chapters.each(function(_, c) {
    c = $(c);
    var header = c.find("h2").text();
    var list = c .next();
    var toc = [];
    list.find("ul li a").each(function(_, a) {
      if ($(a).parent().find("em").length === 0) {
        toc.push([a.textContent.trim(), a.href]);
      }
    });
    index.toc.push({name: header, toc:toc});
  });

  if (index.coverUrl) {
    delete index.url;
  } else {
    index.url = 'http://www.17k.com/book/' + bookid + '.html';
  }
  return index;
}

function cover_indexer(bookid, index, window) {
  var $ = window.$;
  var cover = $("#printMarkBox_Title").next().find("img")[0];
  index.coverUrl = cover.src;
  index.coverWidth = cover.width;
  index.coverHeight = cover.height;
  index.author = index.author || $("span[itemprop='author'] a")[0].textContent;
  index.title = index.title || $(".bookTit .c10 a").text();
  index.brief = $("#tab91_div0").text().trim();
  if (index.toc) {
    delete index.url;
  } else {
    index.url = 'http://www.17k.com/list/' + bookid + '.html';
  }
  return index;
}

exports.indexer = function(index) {
  var tocreg = /^http:\/\/www\.17k\.com\/list\/(\d+)\.html(\?.*)?$/;
  var bookid;
  var r = tocreg.exec(index.url);
  if (r) {
    bookid = r[1];
    return toc_indexer(bookid, index, this);
  } else {
    var coverreg = /^http:\/\/www\.17k\.com\/book\/(\d+)\.html(\?.*)?$/;
    r = coverreg.exec(index.url);
    if (r) {
      bookid = r[1];
      return cover_indexer(bookid, index, this);
    } else {
      throw new Error("not a valid book url");
    }
  }
};

exports.extractor = function() {
  var $ = this.$;
  if (!$) {
    return '';
  }
  var headline = $('h1[itemprop="headline"]');
  var content = $("#chapterContent");
  content.find("div").remove();
  content.find("p.recent_read").remove();
  content.find("script").remove();

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"',
    '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '<title>',
    headline.text(),
    '</title></head>',
    '</head>',
    '<body>',
    '<h2>' + headline.html() + '</h2>',
    content.html(),
    '</body></html>'
  ].join("");
};
