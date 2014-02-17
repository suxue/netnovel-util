var cwd = require('path').resolve(__dirname) + "/tmpl/";

var cache = {};

function template(name) {
  if (!cache[name]) {
    var jade = require('jade');
    var fs = require("fs");
    cache[name] = jade.compile(
      fs.readFileSync(cwd +  name + ".jade"),
      {pretty: true});
  }
  return cache[name];
}

module.exports = template;
