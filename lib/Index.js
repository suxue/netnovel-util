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
Index.prototype.defineProperty('coverUrl', 'string');
Index.prototype.defineProperty('coverHeight', 'number');
Index.prototype.defineProperty('coverWidth', 'number');
Index.prototype.defineProperty('href', 'string');

// make a Index instance from a socalled unweaved plain object
Index.prototype.unweave = function() {
  var out_obj = {};
  var self = this;

  // copy normal properties
  this.findAllProperties().forEach(function(name) {
    if (self[name]) {
      out_obj[name] = self[name]();
    }
  });

  // copy the root_branch
  var toc = [];
  var stack = [];
  var cur = toc;
  var item;
  this.moveRoot().moveFirst();

  while (true) {
    if (this.getType() === 'leaf') {
      item = [this.getName(), this.getUrl()];
      cur.push(item);
      this.moveNext();
    } else if (this.getType() === 'branch') {
      this.enterThisBranch();
      this.moveFirst();
      stack.push(cur);
      item = {"name": this.getLabel(), "toc": []};
      cur.push(item);
      stack.push(cur);
      cur = item.toc;
    } else {
      try {
        self.leaveThisBranch();
        self.moveNext();
        cur = stack.pop();
      } catch (e) {
        if (e instanceof RangeError) {
          break;
        } else {
          throw e;
        }
      }
    }
  }
  out_obj.toc = toc;
  return out_obj;
};

Index.weave = function(in_obj) {
  var out_index = new Index();

  // copy properties
  out_index.findAllProperties().forEach(function(name) {
    if (in_obj[name]) {
      out_index[name](in_obj[name]);
    }
  });

  // copy toc
  function visit(node) {
    if (node instanceof Array) {
      // is leaf
      out_index.setLeaf(node[1], node[0]).moveNext();
    } else if (node.toc instanceof Array && node.name) {
      // is branch
      out_index.openBranch(node.name, function() {
        node.toc.forEach(function(item) {
          visit(item);
        });
      }).moveNext();
    } else {
      throw new Error("not a valid node");
    }
  }
  if (in_obj.toc instanceof Array) {
    in_obj.toc.forEach(function(i) { visit(i); });
  }
  return out_index;
};

Index.prototype.toJSON = function() {
  return JSON.stringify(this.unweave(), null, 4);
};

Index.loadJSON = function(json) {
  var obj = JSON.parse(json);
  return Index.weave(obj);
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
        printBranch(depth+1);
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
  zip.append(tmpl(filename)(), {name: filename});
}

function package_infopage(index, zip) {
  var filename = 'info.html';
  var tmpl = require('./template');
  zip.append(tmpl(filename)({
    title: index.title(),
    author: index.author(),
    brief: index.brief(),
    cover: zip.hasFile("cover.jpg")
  }), {name: filename});
}

function package_mimetype(index, zip) {
  var filename = "mimetype";
  zip.append("application/epub+zip", {name: filename, store: true});
}


function package_content_opf(index, zip, contents) {
  var manifest = [];
  var tmpl = require('./template');

  contents.forEach(function(item) {
    if (item.title) {
      var buf = zip.readLocalFile(item.filename);
      var obj = JSON.parse(buf);
      zip.append(tmpl("chapter.html")({
        title: obj.title || item.title,
        body: obj.body
      }), {name: 'OEBPS/' + item.maniname});
    }
  });

  zip.append(tmpl('content.opf')({
    manifest: manifest,
    title: index.title(),
    brief: index.brief(),
    contents: contents,
    cover: zip.hasFile("cover.jpg")
  }), {name: 'content.opf'});

}

function package_ncx(index, zip) {
  var tmpl = require('./template');
  var contents = [];

  index.moveRoot();
  var depth = 1;
  var curdepth = depth;
  var count = 4;
  var section_count = 0;
  var article_count = 0;
  var sections = [{list:[], title: index.title(), filename:'section0.html'}];
  function compose(parent_section) {
    var list = [];
    var filename;
    var maniname;
    var url;
    var id;
    index.moveFirst();
    while (index.getType() !== null) {
      if (index.getType() === 'leaf') {
        article_count += 1;
        url = new Url(index.getUrl());
        filename = url.getFileName();
        maniname = url.getDigest() + ".html";
        id = "html" + count;
        // id, filename, true
        contents.push({
          id: id,
          maniname: maniname,
          filename: filename,
          title: index.getName()
        });

        sections[parent_section].list.push([index.getName(), maniname]);
        list.push('<navPoint id="' + id + '" playOrder="' + count +
                   '"><navLabel><text>' + index.getName() + '</text></navLabel>' +
                 '<content src="OEBPS/' + maniname + '"/></navPoint>');
        count += 1;
      } else if (index.getType() === 'branch') {
        index.enterThisBranch();
        curdepth += 1;
        if (curdepth > depth) {
          depth = curdepth;
        }
        section_count += 1;
        filename = "section" + section_count + ".html";
        contents.push({id: "section" + section_count,
                       maniname : filename});
        sections[parent_section].list.push([index.getLabel(), filename]);
        sections[section_count] = {filename: filename, title:index.getLabel(), list:[]};
        list.push('<navPoint id="section' + section_count + '" playOrder="' + (count++) +
                   '"><navLabel><text>' + index.getLabel() + '</text></navLabel>' +
                   '<content src="OEBPS/' + filename + '"/>');
        list.push(compose(section_count));
        list.push('</navPoint>');
        index.leaveThisBranch();
        curdepth -= 1;
      }
      index.moveNext();
    }
    return list.join('\n');
  }

  var toctext = compose(0);

  package_content_opf(index, zip, contents, depth);

  sections.forEach(function(s) {
    zip.append(tmpl("section.html")({
      title: s.title,
      items: s.list
    }), {name: 'OEBPS/' + s.filename});
  });

  zip.append(tmpl("toc.ncx")({
    title: index.title(),
    author: index.author(),
    toc: toctext,
    depth: depth
  }), {name: "toc.ncx"});
}


function package_title_page(index, zip) {
  var tmpl = require('./template');
  var filename = "titlepage.xhtml";
  var content = tmpl(filename)({
    width: index.coverWidth(),
    height: index.coverHeight(),
    title: 'Cover',
    cover: zip.hasFile("cover.jpg")
  });
  zip.append(content, {name: filename});
}

function package_tocpage(index, zip) {
  var contents = [
    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">',
    '<head>',
    '<title>'+ index.title() + '</title>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
    '</head>',
    '<body>',
    '<h1>目录</h1>',
    '<ul>',
    '<li><a href="titlepage.xhtml">封面</a></li>',
    '<li><a href="info.html">书籍信息</a></li>',
    '<li><a href="catalog.html">目录</a></li>',
    '<ul>'
  ];
  index.moveRoot();
  var section_count = 0;

  function compose() {
    var con = [];
    var filename;
    index.moveFirst();
    while (index.getType() !== null) {
      if (index.getType() === 'leaf') {
        filename = "OEBPS/" + (new Url(index.getUrl())).getDigest() + ".html";
        con.push('<li><a href="' + filename + '">' + index.getName() + '</a></li>');
      } else if (index.getType() === 'branch') {
        index.enterThisBranch();
        section_count+=1;
        con.push('<li><b>' + index.getLabel() + '</b>');
        con.push('<ul>');
        con.push(compose());
        con.push('</ul></li>');
        index.leaveThisBranch();
      }
      index.moveNext();
    }
    return con.join('\n');
  }

  var text = compose();
  contents.push(text);
  contents.push('</ul></body>');
  zip.append(contents.join('\n'), {name: 'catalog.html'});
}

Index.prototype.package = function(file_directory, output_filename, callback) {
  var archiver = require('archiver'),
      zip = archiver("zip"),
      fs = require("fs");

  zip.on('error', function(err) {
    throw err;
  });

  var output_stream = fs.createWriteStream(output_filename);

  output_stream.on('close', function() {
    callback(zip.pointer());
  });
  zip.pipe(output_stream);

  zip.files = {};
  zip.includeLocalFile = function(externalFile, manifestName) {
    zip.file(file_directory + '/' + externalFile,
              { name: manifestName });
    zip.files[manifestName] = true;
  };

  zip.readLocalFile = function(externalFile) {
    return require("fs").readFileSync(file_directory + '/' + externalFile);
  };

  zip.hasFile = function (name) {
    return zip.files.hasOwnProperty(name);
  };

  package_mimetype(this, zip);
  package_META_INF(this, zip);
  if (fs.existsSync(file_directory + '/cover.jpg')) {
    zip.includeLocalFile("cover.jpg", "cover.jpg");
  }
  package_ncx(this, zip);
  package_tocpage(this, zip);
  package_title_page(this, zip);
  package_infopage(this, zip);

  zip.finalize();
};

module.exports = Index;

if (require.main ===  module) {
  (function() {
    var x = new Index();
    x.author("hello");
    x.setLeaf('http:/1/1', '1').moveNext();
    x.setLeaf('http:/2/2', '2').moveNext();
    x.openBranch('x', function() {
      this.setLeaf('http:/3/3', '3').moveNext();
      this.setLeaf('http:/4/4', '4').moveNext();
    }).moveNext();
    x.openBranch('y', function() {
      this.setLeaf('http:/5/5', '5').moveNext();

      this.openBranch('z', function() {
        this.setLeaf('http:/6/3', '6').moveNext();
        this.setLeaf('http:/6/6', '6').moveNext();
      }).moveNext();
      this.setLeaf('http:/r/m', '7').moveNext();
    });
    console.log(JSON.stringify(x.unweave(), null, 4));
    //console.log(x.toJSON());
    console.log("==============================");
    console.log( JSON.stringify(Index.weave(x.unweave()).unweave(), null ,4) );
  })();
}
