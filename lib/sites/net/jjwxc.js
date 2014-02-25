/*jslint jquery: true, browser: true */

exports.scripts = ["jquery.js"];

exports.encoding = 'gbk';
exports.browser = 'phantom';

exports.indexer = function(index) {
  var window = this;
  var $ = window.$;

  index.title = $("h1[itemprop='name'] span[itemprop='articleSection']").text();
  index.author = $("span[itemprop='author']").text();

  //var chapter_sel = "tr[itemtype='http://schema.org/Chapter'][itemprop^='chapter']";

  var headers = $("td").filter("td[colspan='6']").filter("td[align='center']").filter("td[class!='sptd']").find("b.volumnfont").parent().parent();
  var lastchapter = $("tr[itemtype='http://schema.org/Chapter'][itemprop='chapter newestChapter']");

  index.toc = [];
  headers.each(function(k, header) {
    header = $(header);
    var htext = header.find('.volumnfont').text();
    var cur = {name: htext, toc: []};
    var chapter = header.next();
    var anchor;
    do {
      if (chapter.length !== 1) {
        break;
      }
      if (chapter.is(lastchapter)) { // last chapter
        cur.toc.push([anchor.text(), anchor[0].href]);
        break;
      } else if ($.inArray(chapter[0], headers) >= 0) { // a header
        break;
      } else { // normal chapter
        anchor = chapter.find("span[itemprop='headline'] a");
        cur.toc.push([anchor.text(), anchor[0].href]);
      }
    } while (true);
    index.toc.push(cur);
  });
  delete index.url;
  return index;
};
