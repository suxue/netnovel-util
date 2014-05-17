
exports.browser = 'jsdom';
exports.encoding = 'gbk';
exports.name = "123言情";
exports.scripts = ["jquery-2.0.1.min.js"];

var tocpat = /^http:\/\/www\.123yq\.net\/books\/\d\/(\d+)\/index\.html$/;
var covpat = /^http:\/\/www\.123yq\.net\/read\/(\d+)\/index\.html/;

function toc_indexer(index, bookid) {
  var $ = this.$;
  index.toc = [];
  $("#list dd a").each(function(_, a) {
    index.toc.push([a.textContent, a.href]);
  });
  if (index.title) {
    delete index.url;
  } else {
    index.url = "http://www.123yq.net/read/" + bookid + "/index.html";
  }
  return index;
}

function cov_indexer(index, bookid) {
  var $ = this.$;
  var count = 0;
  $("#info").text().trim().split("\n").forEach(function(line) {
    line = line.trim();
    switch (count) {
      case 0:
        index.title = line;
        break;
      case 1:
        index.author = /作    者：(.+)/.exec(line)[1];
        break;
    }
  });
  index.brief = $("p.introtxt").text().trim();
  var cover = $("#fmimg a img");
  if (cover.length > 0) {
    index.coverUrl = cover[0].src;
    index.coverWidth = cover[0].width;
    index.coverHeight = cover[0].height;
  }
  if (index.toc) {
    delete index.url;
  } else {
    index.url = "http://www.123yq.net/books/" + bookid[0] + "/" +
      bookid + "/index.html";
  }
  return index;
}

exports.indexer = function(index) {
  var bookid;
  if (tocpat.test(index.url)) {
    bookid = tocpat.exec(index.url)[1];
    return toc_indexer.call(this, index, bookid);
  } else if (covpat.test(index.url)) {
    bookid = covpat.exec(index.url)[1];
    return cov_indexer.call(this, index, bookid);
  } else {
    throw new Error("Invalid book index:" + index.url);
  }
};

exports.extractor = function() {
  var $ = this.$;
  var txt = $("#TXT");
  txt.remove("script");
  return {body : txt.html()};
};
