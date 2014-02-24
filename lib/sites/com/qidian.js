/*jslint browser: true */

exports.indexer = function(index) {
  var window = this;
  var document = window.document;

  function make_coverpage_url(bookid) {
    return 'http://www.qidian.com/Book/'+bookid+'.aspx';
  }

  function make_tocpage_url(bookid) {
    return 'http://readbook.qidian.com/bookreader/'+bookid+'.html';
  }

  function coverpage_indexer(bookid) {
      var cover = document.querySelector(".book_pic .pic_box a img");
      index.coverUrl = cover.src;
      index.coverWidth = cover.width;
      index.coverHeight = cover.height;
      index.brief = document.querySelector('.intro .txt span').textContent.trim();
      if (index.author) {
        delete index.url;
        return index;
      } else {
        index.url = make_tocpage_url(bookid);
        return index;
      }
    }

  function tocpage_indexer(bookid) {
    var i, header, chapter,
        booktitle = document.querySelector(".booktitle"),
        content = document.querySelector('#content'),
        chapters = content.querySelectorAll("div.box_title + div.box_cont");

    index.title = booktitle.querySelector("h1").firstChild.data.trim();
    index.author = booktitle.querySelector("span a").firstChild.data;

    var toc = [];
    var curtree;
    for (i=0; i < chapters.length; i++) {
      chapter = chapters[i];
      header = chapter.previousSibling;
      curtree = {};
      curtree.name = header.querySelector("div.title > b a").nextSibling.data;
      curtree.toc = [];
      toc.push(curtree);

      (function() {
          var text, href, list, i, item;
          list = chapter.querySelectorAll("div.list > ul > li");
          for (i=0; i < list.length; i++) {
            item = list[i];
            href = item.firstChild.href;
            text = item.firstChild.firstChild.firstChild.data;
            curtree.toc.push([text, href]);
          }
        })();
    }
    index.toc = toc;

    if (index.coverUrl) {
      delete index.url;
      return index;
    } else {
      index.url = make_coverpage_url(bookid);
      return index;
    }
  }

  var coverpage_pattern = /^http:\/\/www\.qidian\.com\/Book\/(\d+)\.aspx$/;
  var tocpage_pattern = /^http:\/\/readbook\.qidian\.com\/bookreader\/(\d+)\.html$/;
  var rc = coverpage_pattern.exec(index.url);
  var bookid;
  if (rc) {
    bookid = rc[1];
    return coverpage_indexer(bookid);
  }
  rc = tocpage_pattern.exec(index.url);
  if (rc) {
    bookid = rc[1];
    return tocpage_indexer(bookid);
  }
  throw new TypeError(index.url + " is not a valid qidian book url");
};

exports.browser = 'phantom';
exports.scripts = ["jquery.js"];

exports.extractor = function() {
  var window = this;
  var content = window.$("#maincontent");

  function deleteElem(elem) {
    if (elem) {
      elem.remove();
    }
  }


  deleteElem(content.find("script"));
  //deleteFirst(content.find("a[target='_blank'] > span[itemprop!='articleSection']"));
  //deleteElem(content.find("p > a[href='http://www.qidian.com']"));
  deleteElem(content.find("span.to_normallink"));
  deleteElem(content.find('#ascreentype'));
  deleteElem(content.find("div#sykzAdTestReadTop"));
  deleteElem(content.find("div[height='0']"));
  deleteElem(content.find("#aofficetype"));
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
    content.html(),
    '</body></html>'
  ];
  return html.join('');
};
