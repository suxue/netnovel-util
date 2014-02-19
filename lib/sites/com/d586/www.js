exports.encoding = "gbk";
exports.engine = "jsdom";

exports.indexer = function(url, index, window) {
  var document = window.document;

  var title = document.querySelector(".header a").textContent;
  console.log(title[0]);
  if (title[0] === '《' && title[title.length-1] === '》') {
    title = title.slice(1, title.length - 1);
  }
  index.title(title);
  index.author(document.querySelector(".author a").textContent);
  var cover = document.querySelector(".con .img_info img");
  index.cover({src:cover.src, height:cover.height, width:cover.width});
  index.brief(document.querySelector(".description").firstChild.data.trim());

  return index;
};

exports.extractor = function(window) {
  return window.document.outerHTML;
};
