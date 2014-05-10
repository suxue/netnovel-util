exports.browser = 'jsdom';
exports.encoding = 'gbk';
exports.name = "燃文";

var tocpat = /^http:\/\/www\.ranwen\.net\/files\/article\/\d+\/(\d+)\/index.html$/;
var covpat = /^http:\/\/www\.ranwen\.net\/info\/(\d+).htm$/;


function tocindexer(index, bookid) {
  var document = this.document;
  var title = document.querySelector("h1.bname");
  var r;
  var i;
  var sec;
  if (title) {
    index.title = title .textContent;
  }
  var author = title.nextElementSibling;
  if (author) {
    index.author = author.textContent;
    r = /^作者：(.+)$/.exec(author.textContent);
    if (r) {
      index.author = r[1];
    }
  }

  index.toc = [];
  var secs = document.querySelectorAll("div.dccss a");
  for (i=0; i < secs.length; i++) {
    sec = secs[i];
    index.toc.push([sec.textContent, sec.href]);
  }
  if (index.brief) {
    delete index.url;
    return index;
  } else {
    index.url = 'http://www.ranwen.net/info/' + bookid  + '.htm';
    return index;
  }
}

function covindexer(index, bookid) {
  var document = this.document;
  var cover = document.querySelector("img.picborder");
  if (cover) {
    index.coverUrl = cover.src;
    index.coverWidth = cover.width;
    index.coverHeight = cover.height;
  }
  var brief = document.querySelector("#CrbsSum");
  if (brief) {
    index.brief = brief.textContent.trim();
  }

  if (index.toc) {
    delete index.url;
    return index;
  } else {
    index.url = 'http://www.ranwen.net/files/article/' +
              bookid.slice(0,2) +'/' + bookid + ' /index.html';
    return index;
  }
}

exports.indexer = function(index) {
  var bookid;
  if (tocpat.test(index.url)) {
    bookid = tocpat.exec(index.url)[1];
    return tocindexer.call(this, index, bookid);
  } else if (covpat.test(index.url)) {
    bookid = covpat.exec(index.url)[1];
    return covindexer.call(this, index, bookid);
  } else {
    throw new Error("invalid book url");
  }
};

exports.extractor = function() {
  var document = this.document;
  return {
    body: document.getElementById("content").innerHTML
  };
};
