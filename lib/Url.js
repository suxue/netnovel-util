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
Url.prototype.constructor = Url;
Url.prototype.defineProperty('data', 'string');
Url.prototype.getDomain = function() {
  if (this.hasOwnProperty("@domain")) {
    return this["@domain"];
  }

  var urlpat = /^http(?:s)?:\/\/([a-zA-Z0-9.]+)\/(?:.*)$/,
      domain = urlpat.exec(this.data());

  if (domain === null || typeof(domain[1]) !== 'string') {
    throw {
      name: 'RuntimeError',
      message: 'cannot retrieve domain from url:' + this.data()
    };
  } else {
    this['@domain'] = domain[1];
    return domain[1];
  }
};

Url.prototype.getFileName = function() {
  return this.getDigest() + ".html";
};

Url.prototype.getDigest = function() {
  if (this.hasOwnProperty["@digest"]) {
    return this["@digest"];
  } else {
    this["@digest"] = hash(this.data());
    return this["@digest"];
  }
};

Url.prototype.equals = function(other) {
  return this.getDigest() === other.getDigest();
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
