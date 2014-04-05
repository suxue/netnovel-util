/*jslint jquery: true, browser: true */

exports.scripts = ["jquery-2.0.1.min.js"];

exports.browser = 'jsdom';
exports.encoding = 'gbk';

exports.name = "绿晋江";

exports.indexer = function(index) {
  var window = this;
  var $ = window.$;

  index.title = $("h1[itemprop='name'] span[itemprop='articleSection']").text();
  index.author = $("span[itemprop='author']").text();

  var cover = $('.smallreadbody').find('img')[0];
  if (cover) {
    index.coverUrl = cover.src;
    index.coverWidth = cover.width;
    index.coverWidth = cover.height;
  }

  var novelintro = $('#novelintro');
  novelintro.find('style').remove();
  index.brief = novelintro.text();
  index.toc = [];

  var headers = $("td").filter("td[colspan='6']").filter("td[align='center']").filter("td[class!='sptd']").find("b.volumnfont").parent().parent();
  if (headers.length !== 0) {
    var lastchapter = $("tr[itemtype='http://schema.org/Chapter'][itemprop='chapter newestChapter']");
    headers.each(function(k, header) {
      header = $(header);
      var htext = header.find('.volumnfont').text();
      var cur = {name: htext, toc: []};
      var chapter = header.next();
      var anchor;
      var href;
      do {
        if (chapter.length !== 1) {
          break;
        }
        if (chapter.is(lastchapter)) { // last chapter
          href = anchor[0].href;
          if (href) {
            cur.toc.push([anchor.text(), href]);
          }
          break;
        } else if ($.inArray(chapter[0], headers) >= 0) { // a header
          break;
        } else { // normal chapter
          anchor = chapter.find("span[itemprop='headline'] a");
          if (anchor.length === 0) {
            break;
          }
          href = anchor[0].href;
          if (href) {
            cur.toc.push([anchor.text(), href]);
          }
        }
        chapter=chapter.next();
      } while (true);
      index.toc.push(cur);
    });
  } else {
    var chapters = $("tr[itemtype='http://schema.org/Chapter'][itemprop^='chapter']");
    var c = chapters.first();
    var anchor;
    var href;
    while (c) {
      anchor = c.find("span[itemprop='headline'] a");
      if (anchor.length === 1) {
        href = anchor[0].href;
        if (href) {
          index.toc.push([anchor.text(), href]);
        }
      } else {
        break;
      }
      c = c.next();
    }
  }
  delete index.url;
  return index;
};

exports.extractor = function() {
  var $ = this.$;
  var noveltext = $('.noveltext');
  noveltext.find("font[color]").remove();
  noveltext.find("#float_favorite").parent().remove();
  noveltext.find('script').remove();
  noveltext.find('img').remove();

  var html = [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"',
    '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '<title>',
    'TITLE',
    '</title></head>',
    '</head>',
    '<body>',
    noveltext.html(),
    '</body></html>'
  ].join("");
  return html;
};
