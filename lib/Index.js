var Root = require('./Root'),
    Url = require('./Url');

function make_branch(label) {
  if (arguments.length === 1) {
    return {type: 'branch', label: label, cursor:0, data: []};
  } else {
    return {type: 'branch', label: 'anonymous', cursor: 0, data: []};
  }
}

function make_leaf(url, name) {
  return {type: 'leaf', url: Url.normalize(url), name: name};
}

/**
 * class Index
 */
function Index() {
  this.root_branch = make_branch();
  this.history = [];
  this.states = [];
  this.working_branch = this.root_branch;
}

Index.prototype = new Root();
Index.prototype.defineProperty('title', 'string');
Index.prototype.defineProperty('author', 'string');
Index.prototype.defineProperty('status', 'string');
Index.prototype.defineProperty('brief', 'string');
Index.prototype.defineProperty('cover', 'object');

Index.prototype.toJSON = function() {
  var copy = {}, k;
  for (k in this) {
    if (this.hasOwnProperty(k)) {
      switch (k) {
      case "history":
      case "states":
      case "working_branch":
        break;
      default:
        copy[k] = this[k];
      }
    }
  }
  return JSON.stringify(copy, null, 4);
};

Index.loadJSON = function(json) {
  var index = new Index(), k, obj = JSON.parse(json);
  for (k in obj) {
    if (obj.hasOwnProperty(k)) {
      index[k] = obj[k];
    }
  }
  index.working_branch = index.root_branch;
  return index;
};

Index.prototype.getType = function() {
  var cbr = this.working_branch;
  if (cbr.data.length > cbr.cursor) {
    return cbr.data[cbr.cursor].type;
  } else {
    return null;
  }
};

Index.prototype.forEachLeaf = function(callback) {
  var iterator = this.getLeafIterator(), item;
  while ((item = iterator())) {
    callback(item);
  }
};

Index.prototype.getLeafIterator = function() {
  var next, self = this;

  self.moveRoot();
  self.moveFirst();

  next = function() {
    var type = self.getType(), item;
    if (type === 'leaf') {
      item = {url: self.getUrl(), name: self.getName()};
      self.moveNext();
      return item;
    } else if (type === 'branch') {
      self.enterThisBranch();
      self.moveFirst();
      return next();
    } else {
      try {
        self.leaveThisBranch();
        self.moveNext();
        return next();
      } catch (e) {
        if (e instanceof RangeError) {
          return undefined;
        } else {
          throw e;
        }
      }
    }
  };
  return next;
};

Index.prototype._getter = function(type, prop) {
  var cbr = this.working_branch;
  if (this.getType() === type) {
    return cbr.data[cbr.cursor][prop];
  } else {
    throw new TypeError(
      'try to get [' + prop + '] from a non-' + type + ' item');
  }
};

/* which depth the working branch is at */
Index.prototype.getDepth = function() {
  return this.history.length;
};

/* return the label of working branch */
Index.prototype.getLabel = function() {
  return this.working_branch.label;
};

/* return name of current leaf */
Index.prototype.getName = function() {
  return this._getter('leaf', 'name');
};

/* return url of current leaf */
Index.prototype.getUrl = function() {
  return this._getter('leaf', 'url');
};

/* save current position, can be restored by popState(),
 * NOTE: cursor will not be preseved */
Index.prototype.pushState = function() {
  this.states.push({
    history: this.history.concat(),
    working_branch: this.working_branch
  });
  return this;
};

Index.prototype.popState = function() {
  var state = this.states.pop();
  this.working_branch = state.working_branch;
  this.history = state.history;
  return this;
};

Index.prototype.getStatistics = function() {
  var self = this, leafCount = 0, branchCount = 1;

  function countBranch() {
    self.moveFirst();
    while (true) {
      if (self.getType() === 'branch') {
        branchCount += 1;
        self.enterThisBranch();
        countBranch();
        self.leaveThisBranch();
        self.moveNext();
      } else if (self.getType() === 'leaf') {
        leafCount += 1;
        self.moveNext();
      } else {
        break;
      }
    }
  }

  this.pushState().moveRoot();
  countBranch();
  this.popState();
  return {leafCount: leafCount, branchCount: branchCount};
};

/**
 *  moveXXXX -> moving in the working branch
 */
Index.prototype.moveNext = function() {
  this.working_branch.cursor++;
  return this;
};

Index.prototype.moveRoot = function() {
  this.working_branch = this.root_branch;
  return this;
};

Index.prototype.movePrevious = function() {
  this.working_branch.cursor--;
  return this;
};

Index.prototype.moveFirst = function() {
  this.working_branch.cursor = 0;
  return this;
};

Index.prototype.moveLast = function() {
  this.working_branch.cursor = this.working_branch.data.length - 1;
  return this;
};

/* open a new sub-branch at current position of working branch,
 * enter it, run the callback function, then leave it*/
Index.prototype.openBranch = function(label, callback) {
  this.setBranch(label);
  this.enterThisBranch();
  callback.call(this);
  this.leaveThisBranch();
  return this;
};


Index.prototype.enterThisBranch = function() {
  if (this.getType() === 'branch') {
    this.history.push(this.working_branch);
    this.working_branch = this.working_branch.data[this.working_branch.cursor];
    return this;
  } else {
    throw new TypeError('cannot enter, current item is not a branch');
  }
};

Index.prototype.leaveThisBranch = function() {
  if (this.history.length > 0) {
    this.working_branch = this.history.pop();
  } else {
    throw new RangeError('cannot leave, history stack is empty');
  }
};

/* rewrite current position */
Index.prototype.setLeaf = function(url, name) {
  this.working_branch.data[this.working_branch.cursor] = make_leaf(url, name);
  return this;
};

Index.prototype.setBranch = function(label) {
  this.working_branch.data[this.working_branch.cursor] = make_branch(label);
  return this;
};

// NOTE: this will erase the cursor position info
Index.prototype.debugPrint = function(printer) {
  var self = this;
  var generate_indent = function(depth) {
    var i, buffer = [];
    for (i=0; i < depth; i++) {
      buffer.push('|   ');
    }

    self.moveNext();
    if (self.getType() === null) {
      buffer.push('`-- ');
    } else {
      buffer.push('|-- ');
    }
    self.movePrevious();
    return buffer.join("");
  };

  var colors = {
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    grey: '38',
    white: '39',
    reset: '\033[0m',
  };
  for (var k in colors) {
    if (colors.hasOwnProperty(k)) {
      colors['light' + k] = colors[k]+ ';1';
    }
  }

  function text_wrapper(text, color) {
    if (process.stdout.isTTY) {
      return '\033[' + colors[color] + 'm' + text + colors.reset;
    } else {
      return text;
    }
  }

  function printBranch(depth) {
    var type;
    self.moveFirst();
    printer(generate_indent(depth) + text_wrapper(self.getLabel(), 'lightyellow'));
    while ((type=self.getType()) !== null) {
      if (type  === 'branch') {
        // branch
        self.enterThisBranch();
        printBranch(depth+1);
        self.leaveThisBranch();
      } else if (type === 'leaf') {
        printer(generate_indent(depth+1)+
                self.getName() +
                '\t'+ text_wrapper(self.getUrl(), 'cyan'));
      }
      self.moveNext();
    }
  }

  this.pushState();
  this.moveRoot();
  printBranch(0);
  this.popState();
};

function package_META_INF(index, zip) {
  var filename = "META-INF/container.xml";
  zip.file(filename, new Buffer(
    '<?xml version="1.0"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      '  <rootfiles>\n' +
      '    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>\n' +
      '  </rootfiles>\n</container>'));
}

function package_mimetype(index, zip) {
  var filename = "mimetype";
  zip.file(filename, new Buffer("application/epub+zip"));
}

function package_ncx(index, ncx, zip) {
  var content = [];
  var count = 0;
  function a(str) { content.push(str); }

  a("<?xml version='1.0' encoding='utf-8'?>");
  a('<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">');
  a('  <head>');
  a('    <meta content="ce9a2d4a-3b43-4cb9-aa35-3b01571d336d" name="dtb:uid"/>');
  a('    <meta content="2" name="dtb:depth"/>');
  a('    <meta content="calibre (0.9.3)" name="dtb:generator"/>');
  a('    <meta content="0" name="dtb:totalPageCount"/>');
  a('    <meta content="0" name="dtb:maxPageNumber"/>');
  a('  </head>');
  a('  <docTitle>');
  a('    <text>' + index.title() + " -- " +  index.author() + '</text>');
  a('  </docTitle>');
  a('  <navMap>');

  ncx.forEach(function(item) {
    a('    <navPoint class="chapter" id="' + item.id + '" playOrder="' + (++count) + '">');
    a('      <navLabel>');
    a('        <text>'+ item.text + '</text>');
    a('      </navLabel>');
    a('      <content src="'+ item.src + '"/>');
    a('    </navPoint>');
  });
  a('  </navMap>');
  a('</ncx>');
  zip.file("toc.ncx", new Buffer(content.join('\n')));
}

function package_content_opf(index, zip) {
  var content = [];
  var spine = [];
  var add_chapter;
  var base_dir = "feed_0";
  var ncx = [];

  function a(str) { content.push(str); }

  a('<?xml version="1.0"  encoding="UTF-8"?>');
  a('<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uuid_id">');
  a('  <metadata xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:calibre="http://calibre.kovidgoyal.net/2009/metadata" xmlns:dc="http://purl.org/dc/elements/1.1/">');
  a('   <meta name="cover" content="cover"/>');
  a('   <dc:creator opf:role="aut">' + index.author() + '</dc:creator>');
  a('   <dc:language>zh-CN</dc:language>');
  a('   <dc:title>' + index.title() + '</dc:title>');
  a('   <dc:date>' + (new Date()).toISOString() + '</dc:date>');
  a('  </metadata>');

  // start building manifest
  a('  <manifest>');

  // add cover
  a('   <item href="cover.jpg" id="cover" media-type="image/jpeg"/>');
  zip.includeLocalFile("cover.jpg", "cover.jpg");

  // title page
  a('   <item href="titlepage.xhtml" id="titlepage" media-type="application/xhtml+xml"/>');

  a('   <item href="toc.ncx" media-type="application/x-dtbncx+xml" id="ncx"/>');
  spine.push('<spine toc="ncx">');
  spine.push('<itemref idref="titlepage"/>');

  // add chapters
  add_chapter = (function () {
    var count = 0, Url = require('../lib/Url');
    function get_filename(url) {
      return (new Url(url)).getFileName();
    }

    return function(item) {
      var url = item.url;
      var filename = get_filename(url);
      var manifest_name = base_dir + "/" + filename;
      a('   <item href="' + manifest_name  +
        '" id="html' + (++count) + '" ' +
        'media-type="application/xhtml+xml"/>');
      spine.push('<itemref idref="html' + count + '"/>');
      zip.includeLocalFile(filename, manifest_name);
      ncx.push({id: "html" + count, src : manifest_name, text: item.name });
    };
  })();
  index.forEachLeaf(function(item) {
    add_chapter(item);
  });
  a('  </manifest>');
  spine.push('</spine>');
  a(spine.join('\n'));
  a('</package>');
  zip.file("content.opf", new Buffer(content.join("\n")));
  package_ncx(index, ncx, zip);
}

function package_title_page(index, zip) {
  var content = [];
  function a(str) { content.push(str); }
  a("<?xml version='1.0' encoding='utf-8'?>");
  a('<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">');
  a('    <head>');
  a('        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>');
  a('        <title>Cover</title>');
  a('        <style type="text/css" title="override_css">');
  a('            @page {padding: 0pt; margin:0pt}');
  a('            body { text-align: center; padding:0pt; margin: 0pt; }');
  a('        </style>');
  a('    </head>');
  a('    <body>');
  a('        <div>');
  a('            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 200 160" preserveAspectRatio="none">');
  a('                <image width="' + index.cover().width +
    '" height="' + index.cover().height + '" xlink:href="cover.jpg"/>');
  a('            </svg>');
  a('        </div>');
  a('    </body>');
  a('</html>');
  zip.file("titlepage.xhtml", new Buffer(content.join("\n")));
}

Index.prototype.package = function(file_directory, output_filename) {
  var Jszip = require('jszip'),
      zip = new Jszip(),
      fs = require("fs");

  if (typeof(output_filename) !== 'string') {
    output_filename = this.title() + ".epub";
  }

  zip.includeLocalFile = function(externalFile, manifestName) {
    var buffer = new Buffer(fs.readFileSync(file_directory + "/" + externalFile));
    zip.file(manifestName, buffer);
  };

  package_mimetype(this, zip);
  package_META_INF(this, zip);
  package_content_opf(this, zip);
  package_title_page(this, zip);

  fs.writeFileSync(output_filename, zip.generate({type: "nodebuffer",
                                         compression: "DEFLATE" }));
  console.log("write " + output_filename);
};

module.exports = Index;
