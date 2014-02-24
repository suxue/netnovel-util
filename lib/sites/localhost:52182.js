/*jslint browser: true */
exports.browser = 'phantom';

exports.extractor = function() {
  var document = this.document;
  return document.title;
};
