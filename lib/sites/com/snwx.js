exports.name = "少年文学";
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

  return {
    title: bookname.text().trim(),
    body: booktext.html()
  };

};
