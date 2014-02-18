exports.indexer = function(url, index, window) {

  function extractNovelInfo(parentNode) {
    var pat = /^\s*(.+):(.+)$/;
    for (var c = parentNode.firstChild; c !== null; c = c.nextSibling) {
      if (c.nodeType === window.Node.TEXT_NODE) {
        var tmp = pat.exec(c.data);
        if (tmp !== null) {
          var key = tmp[1];
          var value = tmp[2];
          switch (key) {
          case "作者":
            index.author(value);
            break;
          case "状态":
            index.status(value);
            break;
          case "简介":
            index.brief(value);
            break;
          }
        }
      }
    }
  }

  function get_toc(toc) {
    var list = toc.getElementsByClassName("zl");
    for (var i = 0; i < list.length; i++) {
      var li = list[i];
      var a = li.firstChild;
      var text = a.firstChild.data;
      var link = a.href;
      index.setLeaf(link, text).moveNext();
    }
  }

  var document = window.document;
  var tit = document.getElementsByClassName("tit")[0];
  extractNovelInfo(tit.parentNode);
  index.title(tit.firstChild.firstChild.data);
  index.cover(
    (function(brother) { // search for img
      for (var x = brother.nextSibling; x; x = x.nextSibling) {
        if (x.nodeType === window.Node.ELEMENT_NODE &&
            x.tagName === 'IMG')
          return {src: x.src, width: x.width, height: x.height};
      }
    })(tit));
  get_toc(document.getElementsByClassName("tit")[1].parentNode.children[1]);
  return index;
};

exports.extractor = function(window) {
  function removeNode(node) {
    node.parentNode.removeChild(node);
  }
  function removeNodes(nodes) {
    var i,
        to_delete = [];
    for (i = 0; i < nodes.length; i++) {
      to_delete.push(nodes[i]);
    }
    for (i = 0; i < to_delete.length; i++) {
      removeNode(to_delete[i]);
    }
  }

  var document = window.document;
  var content = document.getElementById("content");
  removeNodes(content.getElementsByTagName("script"));
  removeNodes(content.getElementsByClassName("bad"));
  removeNode(content.lastChild);
  removeNode(content.lastChild);
  removeNode(content.lastChild);
  removeNode(content.lastChild);

  removeNodes(content.querySelectorAll("img"));

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
    content.innerHTML,
    '</body></html>'
  ].join("");

  return html;
};
