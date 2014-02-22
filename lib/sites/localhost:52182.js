exports.browser = 'phantom';

exports.extractor = function(window) {
  return window.document.title;
};
