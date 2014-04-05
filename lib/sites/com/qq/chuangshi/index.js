/*jslint jquery: true, browser: true */

exports.scripts = ["jquery-2.0.1.min.js"];
exports.name = "创世";

function cover_indexer(bookid, index, window) {
  var $ = window.$;
  index.title = index.title || $(".title strong a").text();
  index.author = index.author || $("#textauthor span a").text();
  index.brief = $(".info").text().trim();
  var cover = $(".cover .bookcover img")[0];
  index.coverUrl = cover.src;
  index.coverWidth = cover.width;
  index.coverHeight = cover.height;
  if (index.toc) {
    delete index.url;
  } else {
    index.url = 'http://chuangshi.qq.com/read/bk/' + bookid + '-m.html';
  }
  return index;
}

function toc_indexer(bookid, index, window) {
  var $ = window.$;
  index.title = index.title || $(".title a b").text();
  var chapters = $(".title01.juan_height");
  chapters.find(".f900").parent().parent().remove();
  chapters = $(".title01.juan_height");

  index.toc = [];
  chapters.each(function(_, c) {
    c = $(c);
    c.find("a").remove();
    var header = c.text();
    var list = c.parent().parent().find("ul.block_ul li a");
    var toc = [];
    list.each(function(_, i) {
      var href = i.href;
      var text = $(i).find(".title").text();
      toc.push([text, href]);
    });
    index.toc.push({name: header, toc: toc});
  });

  if (index.author) {
    delete index.url;
  } else {
    index.url = 'http://chuangshi.qq.com/read/bk/' + bookid + '-1.html';
  }
  return index;
}


exports.indexer = function(index) {
  var tocreg = /^http:\/\/chuangshi\.qq\.com\/read\/bk\/([a-zA-Z]+\/\d+)-m\.html$/;
  var bookid;
  var r = tocreg.exec(index.url);
  if (r) {
    bookid = r[1];
    return toc_indexer(bookid, index, this);
  } else {
    var coverreg = /^http:\/\/chuangshi\.qq\.com\/read\/bk\/([a-zA-Z]+\/\d+)-1.html$/;
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
  var title = $("div.textbox h1").text();
  var textintro = $(".textinfo");
  textintro.find("a").removeAttr("href");
  var content=$("div.text.bookreadercontent");
  content.find("p").last().remove();

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"',
    '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '<title>',
    title,
    '</title></head>',
    '</head>',
    '<body>',
    '<h2>',
    title,
    '</h2>',
    textintro.html(),
    content.html(),
    '</body></html>'
  ].join("");
};

exports.extractor.browser = 'phantom';
