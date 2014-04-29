
exports.name = "百万书库";
exports.encoding = 'gbk';
exports.scripts = ["jquery-2.0.1.min.js"];
exports.indexer = function(index) {
  var $ = this.$;
  var table = $($('table[width="680"]')[0]);

  index.author = $(table.find("span")[0]).find("a").last()
                 .text().replace('作品集', '');
  index.title = table.find("span").last().text();
  index.toc = [];
  table.find('tbody tr td[width="50%"] a').each(function(i, a) {
    index.toc.push([$(a).text(), a.href]);
  });
  delete index.url;
  return index;
};
exports.indexer.browser = 'phantom';

exports.extractor = function() {
  var $ = this.$;
  var tt2 = $('.tt2');
  tt2.find('font b').remove();
  tt2.find('hr').remove();
  return { body : tt2.html() };
};
