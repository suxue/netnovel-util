/*jslint browser: true */

exports.encoding = "gbk";
exports.engine = "jsdom";

exports.indexer = function(index) {
  var window = this;
  var document = window.document;

  var title = document.querySelector(".header a").textContent;
  if (title[0] === '《' && title[title.length-1] === '》') {
    title = title.slice(1, title.length - 1);
  }
  index.title = title;
  index.author = document.querySelector(".author a").textContent;
  var cover = document.querySelector(".con .img_info img");
  index.coverUrl = cover.src;
  index.coverWidth = cover.width;
  index.coverHeigth = cover.heigth;
  index.brief = document.querySelector(".description").firstChild.data.trim();

  index.toc = [];
  var toc;
  var base;

  base = document.querySelector("#mlad_3 + ul");

  toc = base.querySelectorAll("ul");
  var curtree;
  for (var i=0; i < toc.length; i++) {
    (function(ul) {
        var h3 = ul.previousSibling;
        while (h3 && h3.nodeType !== window.Node.ELEMENT_NODE) {
          h3 = h3.previousSibling;
        }
        if (h3 && h3.tagName === "H3") {
          var section_name = h3.textContent.trim();
          curtree = {name: section_name, toc: []};
          index.toc.push(curtree);
          curtree = curtree.toc;
        } else {
          curtree = index.toc;
        }
        var list = ul.querySelectorAll("li > a");
        var name, href;
        for (var i=0; i < list.length; i++) {
          href = list[i].href;
          name = list[i].textContent;
          curtree.push([name, href]);
        }
      })(toc[i]);
  }

  delete index.url;
  return index;
};

exports.extractor = function() {
  var window = this;
  var content = window.document.querySelector(".yd_text2").innerHTML;
  var vote = window.document.querySelector(".vote");
  while (vote && vote.tagName !== 'H2') {
    vote = vote.previousSibling;
  }

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
    vote.innerHTML,
    content,
    '</body></html>'
  ].join("");
  return html;
};
