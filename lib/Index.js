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
          if (e.name === 'BoundError') {
            return undefined;
          } else {
            throw e;
          }
       }
    }
  }
  return next;
}

Index.prototype._getter = function(type, prop) {
  var cbr = this.working_branch;
  if (this.getType() === type) {
    return cbr.data[cbr.cursor][prop];
  } else {
    throw {
      name: 'TypeError',
      message: 'try to get [' + prop + '] from a non-' + type + ' item'
    };
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
}

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
  this.setBranch('header 1');
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
    throw {
      name: 'TypeError',
      message: 'cannot enter, current item is not a branch'
    };
  }
};

Index.prototype.leaveThisBranch = function() {
  if (this.history.length > 0) {
    this.working_branch = this.history.pop();
  } else {
    throw {
      name: 'BoundError',
      message: 'cannot leave, history stack is empty'
    };
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
  function gen_indent(indent) {
    var str = [];
    for (var i=0; i < indent; i++) {
      str.push(' ');
    }
    return str.join('');
  }

  function printBranch(indent) {
    var i, type;
    self.moveFirst();
    printer(gen_indent(indent) + 'label:' + self.getLabel());
    while ((type=self.getType()) !== null) {
      if (type  === 'branch') {
        // branch
        self.enterThisBranch();
        printBranch(indent+4);
        self.leaveThisBranch();
      } else if (type === 'leaf') {
        printer(gen_indent(indent)+'||'+ 'name:' + self.getName() +
                    ' url:'+ self.getUrl());
      }
      self.moveNext();
    }
  }

  this.pushState();
  this.moveRoot();
  printBranch(0);
  this.popState();
};

module.exports = Index;

function test()  {
  var index = new Index();
  index.setLeaf('http://lfs8/8.html', 'eight').moveNext();
  index.setLeaf('http://lfs7/7.html', 'seven').moveNext();
  index.openBranch('header 1', function() {
    this.setLeaf('http://lfs5/5.html', 'five').moveNext();
    this.setLeaf('http://lfs6/6.html', 'six').moveNext();

    this.setBranch('baidu');
    {
      this.enterThisBranch();
      this.setLeaf('http://www.google.com/', 'google');
      this.leaveThisBranch();
    }
    this.moveNext();

    this.setLeaf('http://lfs9/9.html', 'nine');
  }).moveNext();
  index.setLeaf('http://cnbeta.com/index.html', 'cnbeta');

  index = Index.loadJSON(index.toJSON());
  index.debugPrint(console.log);
  console.log("==== statistics ===");
  var statistics = index.getStatistics();
  console.log(JSON.stringify(statistics));
}

if (require.main === module) { test(); }