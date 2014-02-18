var Root = require('./Root');

function hash(str) {
  var digester = require('crypto').createHash('sha1');
  digester.update(str, 'utf8');
  return digester.digest('hex');
}

function url_normolize(input) {
  var output = decodeURI(input),
      pat = /^http(s)?:\/\//;

  if (!pat.test(output)) {
    output = "http://" + output;
  }
  return output;
}

/**
 * stub
 */
function Url(str) {
  if (typeof(str) === 'string') {
    this.data(Url.normalize(str));
  }
}
Url.normalize = url_normolize;
Url.equals = function(input1, input2) {
  return (new Url(input1)).equals(new Url(input2));
};


Url.prototype = new Root();
Url.prototype.defineProperty('data', 'string');
Url.prototype.getDomain = function() {
  var urlpat = /^http(?:s)?:\/\/([a-zA-Z0-9.]+)\/(?:.*)$/,
      domain = urlpat.exec(this.data());

  if (domain === null || typeof(domain[1]) !== 'string') {
    throw {
      name: 'RuntimeError',
      message: 'cannot retrieve domain from url:' + this.data()
    };
  } else {
    return domain[1];
  }
};

Url.prototype.getFileName = function() {
  return this.getDigest() + ".html";
};

Url.prototype.getDigest = function() {
  return hash(this.data());
};

Url.prototype.equals = function(other) {
  return this.getDigest() === other.getDigest();
};

var alias = {
  "www.qidian.com": "qidian.com",
  "readbook.qidian.com": "qidian.com",
  "read.qidian.com": "qidian.com"
};

Url.prototype.getScript = function() {
  var domain = this.getDomain();
  var map = alias[domain];
  if (map) {
    return require('./sites/' + map);
  } else {
    return require('./sites/' + domain);
  }
};

module.exports = Url;


function test() {
  var url, url1, url2;
  url = url1 = new Url(
    'gitready.com/advanced/2009/02/10/squashing-commits-with-rebase.htm');
  console.log(url.data());
  console.log(url.getDomain());
  console.log(url.getFileName());
  console.log(url.getDigest());
  console.log("===============");

  url = url2 = new Url('https://gitready.com/one?out&three');
  console.log(url.data());
  console.log(url.getDomain());
  console.log(url.getFileName());
  console.log(url.getDigest());
  console.log("===============");

  console.log(url1.equals(url2));
}

if (require.main === module) { test(); }
