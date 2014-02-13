/*global describe, it */

var should = require('chai').should(),
    Index = require('../lib/Index');

describe('Index', function(){

  describe("simple actions", function() {
    var index = {};

    it('create a new Index', function() {
      index.a = new Index();
      should.exist(index.a);
    });

    it('setter and getter', function() {
      var author = "shellfish";
      index.a.setAuthor(author).getAuthor().should.equal(author);
    });

    it('alternative setter and getter', function() {
      var title = "a book";
      index.a.title(title).title().should.equal(title);
    });

    it('object property setter/getter', function() {
      var cover1 = {width:100, height:200},
          cover2 = {width:100, height:200};
      index.a.setCover(cover1).getCover().should.deep.equal(cover2);
    });


    it('seriializing and deserializing', function() {
      var i = Index.loadJSON(index.a.toJSON());
      i.should.deep.equal(index.a);
    });


  });

  describe('walk through the index', function() {
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
    // index.debugPrint(console.log);

    it('check statistics', function() {
      var stat = index.getStatistics();
      stat.branchCount.should.equal(3);
      stat.leafCount.should.equal(7);
    });

    it('check depth', function() {
      index.moveRoot();
      index.getDepth().should.equal(0);
    });

    it('check type if is branch', function() {
      index.moveFirst().moveNext().moveNext();
      index.getType().should.equal('branch');
    });

    it('check branch label', function() {
      index.enterThisBranch().getLabel().should.equal('header 1');
    });

    it('check value', function() {
      index.moveFirst().moveNext().moveNext().enterThisBranch();
      index.moveFirst().getName().should.equal('google');
    });
  });

});
