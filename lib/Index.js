var Root = require('./Root'),
    Url = require('./Url');

function make_branch(label) {
  if (arguments.length === 1) {
    return {type: 'branch', label: label, cursor:0, data: []};
  } else {
    return {type: 'branch', label: 'root', cursor: 0, data: []};
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
Index.prototype.constructor = Index;
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
  function generate_indent(depth) {
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
  }

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
    if (depth !== 0) {
      printer(generate_indent(depth-1) +
            text_wrapper(self.getLabel(), 'lightyellow'));
    }
    while ((type=self.getType()) !== null) {
      if (type  === 'branch') {
        // branch
        self.enterThisBranch();
        printBranch(depth);
        self.leaveThisBranch();
      } else if (type === 'leaf') {
        printer(generate_indent(depth)+
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
  var tmpl = require('./template');
  zip.file(filename, tmpl(filename)());
}

function package_mimetype(index, zip) {
  var filename = "mimetype";
  zip.file(filename, new Buffer("application/epub+zip"));
}

function package_ncx(index, ncx, zip) {
  var tmpl = require('./template');

  zip.file("toc.ncx", tmpl("toc.ncx")({
    title: index.title(),
    author: index.author(),
    toc: ncx
  }));
}

function package_content_opf(index, zip) {
  var manifest = [];
  var ncx = [];
  var spine = [];
  var basedir = "OEBPS/";
  var Url = require('./Url');
  var tmpl = require('./template');
  var count = 1;
  index.forEachLeaf(function(item) {
    var filename = (new Url(item.url)).getFileName();
    var manifest_name = basedir + filename;
    var id = 'html' + count;
    manifest.push({
      id: id,
      href: manifest_name,
    });
    ncx.push({
      id: id,
      src: manifest_name,
      text: item.name,
      index: count
    });
    count++;
    spine.push(id);
    zip.includeLocalFile(filename, manifest_name);
  });

  zip.file('content.opf', tmpl('content.opf')({
    manifest: manifest,
    title: index.title(),
    brief: index.brief(),
    spine: spine
  }));

  zip.includeLocalFile("cover.jpg", "cover.jpg");
  package_ncx(index, ncx, zip);
}

function package_title_page(index, zip) {
  var tmpl = require('./template');
  var filename = "titlepage.xhtml";
  var content = tmpl(filename)({
    width: index.cover().width,
    height: index.cover().height,
    title: 'Cover'
  });
  zip.file(filename, content);
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
