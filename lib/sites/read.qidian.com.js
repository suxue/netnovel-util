var Index = require('../Index');

exports.indexer = function(window) {
  var i, header, chapter,
      index = new Index(),
      document = window.document,
      booktitle = document.querySelector(".booktitle"),
      content = document.querySelector('#content'),
      chapters = content.querySelectorAll("div.box_title + div.box_cont");

  index.title(booktitle.querySelector("h1").firstChild.data.trim());
  index.author(booktitle.querySelector("span a").firstChild.data);

  for (i=0; i < chapters.length; i++) {
    chapter = chapters[i];
    header = chapter.previousSibling;
    index.openBranch(
      header.querySelector("div.title > b a").nextSibling.data, function() {
        var text, href, list, i, item;
        list = chapter.querySelectorAll("div.list > ul > li");
        for (i=0; i < list.length; i++) {
          item = list[i];
          href = item.firstChild.href;
          text = item.firstChild.firstChild.firstChild.data;
          index.setLeaf(href, text).moveNext();
        }
      }).moveNext();
  }

  return index;
};
