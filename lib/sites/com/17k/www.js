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
  var content = $("#chapterContentWapper");
  content.find("div").remove();
  content.find("p.recent_read").remove();
  content.find("script").remove();

  return {
    title: headline.text(),
    body: content.html()
  };
};
