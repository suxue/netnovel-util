exports.encoding = "gbk";
exports.engine = "jsdom";

exports.indexer = function(url, index, window) {
  var document = window.document;

  var title = document.querySelector(".header a").textContent;
  if (title[0] === '《' && title[title.length-1] === '》') {
    title = title.slice(1, title.length - 1);
  }
  index.title(title);
  index.author(document.querySelector(".author a").textContent);
  var cover = document.querySelector(".con .img_info img");
  index.cover({src:cover.src, height:cover.height, width:cover.width});
  index.brief(document.querySelector(".description").firstChild.data.trim());

  var toc = document.querySelector("#mlad_3 + ul")
                      .querySelectorAll("h3 + ul");
  index.moveRoot().moveFirst();
  for (var i=0; i < toc.length; i++) {
    (function(ul) {
        var h3 = ul.previousSibling;
        while (h3 && h3.nodeType !== window.Node.ELEMENT_NODE) {
          h3 = h3.previousSibling;
        }
        var section_name = h3.textContent.trim();
        index.openBranch(section_name, function() {
          var list = ul.querySelectorAll("li > a");
          var name, href;
          for (var i=0; i < list.length; i++) {
            href = list[i].href;
            name = list[i].textContent;
            this.setLeaf(href, name).moveNext();
          }
        }).moveNext();
      })(toc[i]);
  }

  return index;
};

exports.extractor = function(window) {
  var content = window.document.querySelector(".yd_text2").innerHTML;
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
    content,
    '</body></html>'
  ].join("");
  return html;
};
