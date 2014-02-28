/*jslint jquery: true, browser: true */

exports.scripts = ["jquery-2.0.1.min.js"];

function book_indexer(bookid, index, window) {
  var $ = window.$;
  var cover = $(".zhbook_info  .imgbox a img")[0];
  index.coverUrl = cover.src;
  index.coverWidth = cover.width;
  index.coverHeight = cover.height;
  index.brief = $('p[itemprop="description"]').text();
  index.title = index.title || $("div.status span[itemprop='name']").text();
  index.author = index.author || $("p.author em a").text();
  if (index.toc) {
    delete index.url;
  } else {
    index.url = 'http://book.zongheng.com/showchapter/' + bookid + '.html';
  }
  return index;
}

function showchapter_indexer(bookid, index, window) {
  var $ = window.$;
  index.title = index.title || $(".wrap.chaplist .title h1").text();
  index.author = index.author || $(".author a.fb").text();
  index.toc = [];

  var chapter = $(".chapter");
  var booklists = chapter.find(".booklist");
  booklists.each(function(_, list) {
    var h2 = list;
    var headertext = "***";
    while (h2) {
      if (h2.nodeType === window.Node.ELEMENT_NODE && h2.tagName === 'H2') {
        headertext = h2.textContent;
        break;
      }
      h2 = h2.previousSibling;
    }
    var links = $(list).find("table tr td a");
    var toc = [];
    links.each(function(_, a) {
      toc.push([a.textContent, a.href]);
    });
    index.toc.push({name: headertext, toc: toc});
  });

  if (index.coverUrl) {
    delete index.url;
  } else {
    index.url = 'http://book.zongheng.com/book/' + bookid + '.html';
  }
  return index;
}

exports.indexer = function(index) {
  var listreg = /^http:\/\/book\.zongheng\.com\/showchapter\/(\d+)\.html$/;
  var bookid;
  var r = listreg.exec(index.url);
  if (r) {
    bookid = r[1];
    return showchapter_indexer(bookid, index, this);
  } else {
    var bookreg = /^http:\/\/book\.zongheng\.com\/book\/(\d+)\.html$/;
    r = bookreg.exec(index.url);
    if (r) {
      bookid = r[1];
      return book_indexer(bookid, index, this);
    } else {
      throw new Error("not a valid book url");
    }
  }
};

exports.extractor = function() {
  var $ = this.$;
  var title = $("em[itemprop='headline']").text();
  var content = $("#chapterContent");
  content.find("span.watermark").remove();

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
    content.html(),
    '</body></html>'
  ].join("");
};
