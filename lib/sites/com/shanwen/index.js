exports.scripts = ["jquery-2.0.1.min.js"];
exports.encoding = "gbk";
exports.name = "闪文书库";

function cover_indexer(bookid, index, window) {
  var $ = window.$;
  var title = $("span.colorblue");
  index.title = title.text();
  var author = title.parent();
  author.find("span").remove();
  index.author = /^作者:(.+)$/.exec(author.text().trim())[1];
  var imgs = $("img");
  imgs = imgs.filter(function(i) {
    var img = imgs[i];
    if (img.src.match('http://www.shanwen.com/files/article/image/' + bookid + '.*.jpg'))
      return true;
    else
      return false;
  });
  if (imgs.length === 1) {
    var cover = imgs[0];
    index.coverUrl = cover.src;
    index.coverWidth = cover.width;
    index.coverHeight = cover.height;
  }

  index.brief = $("font[color='#000000']").text().trim().replace(/找回密码\s*/, "");

  if (index.toc) {
    delete index.url;
  } else {
    index.url = 'http://read.shanwen.com/'+ bookid + '/index.html';
  }
  return index;
}

function toc_indexer(bookid, index, window) {
  var $ = window.$;
  var headers = $("tr td[bgcolor='#DDF2FF']").parent();
  index.toc =  [];
  headers.each(function(_, h) {
    var htext = $(h).text().trim();
    var toc = [];
    index.toc.push({name: htext, toc: toc});
    var c = $(h).next();
    while (c.length > 0 && c.attr("bgcolor") === '#F5FBFF') {
      c.find("td a").each(function(_, a) {
        toc.push([$(a).text(), a.href]);
      });
      c = c.next();
    }
  });

  if (index.coverUrl) {
    delete index.url;
  } else {
    index.url = 'http://www.shanwen.com/swinfo/' + bookid + '.htm';
  }
  return index;

}

exports.indexer = function(index) {
  var window = this;
  var r;
  do {
    r = /^http:\/\/www\.shanwen\.com\/swinfo\/(\d+\/\d+)\.htm$/.exec(index.url);
    if (r) {
      return cover_indexer(r[1], index, window);
    } else {
      r = /^http:\/\/read\.shanwen\.com\/(\d+\/\d+)\/index\.html$/.exec(index.url);
      if (r) {
        return toc_indexer(r[1], index, window);
      }
    }
  } while (false);

  throw new Error("invalid url");
};

exports.extractor = function() {
  var $ = this.$;
  var content = $("#content");
  var lastbr = content.find("br").last()[0];
  var par = lastbr.parentNode;
  var torm = [];
  while (lastbr) {
    torm.push(lastbr);
    lastbr = lastbr.nextSibling;
  }
  torm.forEach(function(i) { par.removeChild(i); });
  var title = $(".newstitle").text();

  return {
    title: title,
    body: content.html()
  };
};
