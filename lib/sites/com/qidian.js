var Url;

function make_coverpage_url(bookid) {
  return new Url('http://www.qidian.com/Book/'+bookid+'.aspx');
}

function make_tocpage_url(bookid) {
  return new Url('http://readbook.qidian.com/bookreader/'+bookid+'.html');
}

function coverpage_indexer(bookid, index, window) {
  var document = window.document;
  var cover = document.querySelector(".book_pic .pic_box a img");
  index.cover({height:cover.height, width:cover.width, src: cover.src});
  var brief = document.querySelector('.intro .txt span').textContent.trim();
  index.brief(brief);
  if (index.author()) {
    return index;
  } else {
    return make_tocpage_url(bookid);
  }
}


function tocpage_indexer(bookid, index, window) {
  var i, header, chapter,
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

  if (index.cover()) {
    return index;
  } else {
    return make_coverpage_url(bookid);
  }
}

var coverpage_pattern = /^http:\/\/www\.qidian\.com\/Book\/(\d+)\.aspx$/;
var tocpage_pattern = /^http:\/\/readbook\.qidian\.com\/bookreader\/(\d+)\.html$/;

exports.indexer = function(url, index, window) {
  Url = url.constructor;
  var rc = coverpage_pattern.exec(url.data());
  var bookid;
  if (rc) {
    bookid = rc[1];
    return coverpage_indexer(bookid, index, window);
  }
  rc = tocpage_pattern.exec(url.data());
  if (rc) {
    bookid = rc[1];
    return tocpage_indexer(bookid, index, window);
  }
  throw new TypeError(url.data() + " is not a valid qidian book url");
};

exports.extractor = function(window) {
  var content = window.document.querySelector("#maincontent");
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
  ];
  return html.join('');
};
