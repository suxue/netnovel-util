exports.encoding = 'gbk';
exports.scripts = ["jquery-2.0.1.min.js"];
exports.indexer = function(index) {
  var $=this.$;
  var title = $("#info .infotitle");
  index.title = title.find("h1").text();

  var author_regexp = /^作者：(.+)$/;
  index.author = author_regexp.exec(title.find("i").first().text())[1];
  index.beief = $("div.intro").text();

  var cover = $("#fmimg img")[0];
  index.coverUrl = cover.src;
  index.coverWidth = cover.width;
  index.coverHeight = cover.height;

  var links = $("#list dl dd a");
  var toc = [];
  links.each(function(i, a) {
    toc.push([a.title, a.href]);
  });
  index.toc = toc;

  delete index.url;
  return index;
};

exports.extractor = function extractor() {
  var $ = this.$;

  var bookname = $('div.bookname');
  var booktext = $('#BookText');

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"',
    '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '<title>',
    $('div.bookname').text().trim(),
    '</title></head>',
    '</head>',
    '<body>',
    bookname.html(),
    booktext.html(),
    '</body></html>'
  ].join("");
};
