var Minimize = require('minimize');
var async    = require('async');
var del      = require('del');
var fs       = require('fs');
var zlib     = require('zlib');

var minimize = new Minimize({});
var dir = __dirname + '/files/app/';
var inputFile = dir + 'index.html';
var outputDir = __dirname + '/dist/';

var files = {
  'orig': outputDir + 'index.orig.html',
  'min': outputDir + 'index.min.html',
  get origZip () {
    return this.orig + '.gz';
  },
  get minZip () {
    return this.min + '.gz';
  }
};

async.series([
  function (callback) {
    del('dist/*', function () {
      callback(null);
    });
  },
  function (callback) { 
    // copy original file to dist
    var temp = fs.createReadStream(inputFile)
      .pipe(fs.createWriteStream(files.orig));
    temp.on('finish', function () { 
      callback(null); 
    });
  },
  function (callback) {
    // minified version
    fs.readFile(inputFile, 'utf8', function (err,data) {
      if (err) {
        return console.log(err);
      }
      minimize.parse(data , function (error, data) {
        fs.writeFile(files.min, data, callback);
      });
    });
  },
  function (callback) {
    var origStream = fs.createReadStream(files.orig);
    var minStream = fs.createReadStream(files.min);
    // gzip both original and minified
    origStream
      .pipe(zlib.createGzip())
      .pipe(fs.createWriteStream(files.origZip));
    origStream.on('end', function () {
      minStream
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream(files.minZip));
      minStream.on('end', function () {
        callback(null);
      });
    });
  },
  function (callback) {
    console.log('ayy lmao');
    callback(null);
  }
], function (err) {
  console.log('success');
});
