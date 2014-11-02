#!/usr/bin/env node

var Minimize     = require('minimize');
var Table        = require('cli-table');
var _            = require('lodash');
var async        = require('async');
var csv          = require('csv');
var del          = require('del');
var fs           = require('fs');
var glob         = require('glob');
var lengthStream = require('length-stream');
var util         = require('util');
var zlib         = require('zlib');

var minimize = new Minimize({});
var outputDir = __dirname + '/dist/';
var getFileName = function (path) {
  path = path.split('/');
  return path[path.length - 1];
};

var files;

function calculateSavings(file) {
  return Math.abs(file.gzip.size - file.gzipAndMin.size) / file.source.size * 100 + '%';
}

function processFile(file, cb) {
  async.series([
    function (callback) { 
      // copy original file to dist
      var temp = fs.createReadStream(file.source.path)
        .pipe(lengthStream(function (l) {
          file.source.size = l;
        }))
        .pipe(fs.createWriteStream(outputDir + getFileName(file.source.path)));
      temp.on('finish', function () { 
        callback(null); 
      });
    },
    function (callback) {
      // minified version
      fs.readFile(file.source.path, 'utf8', function (err,data) {
        if (err) {
          return console.log(err);
        }
        minimize.parse(data , function (error, data) {
          file.min.size = data.length;
          fs.writeFile(file.min.path, data, callback);
        });
      });
    },
    function (callback) {
      var origStream = fs.createReadStream(file.source.path);
      var minStream = fs.createReadStream(file.min.path);
      // gzip both original and minified
      origStream
        .pipe(zlib.createGzip())
        .pipe(lengthStream(function (l) {
          file.gzip.size = l;
        }))
        .pipe(fs.createWriteStream(file.gzip.path))
        .on('finish', function () {
          minStream
            .pipe(zlib.createGzip())
            .pipe(lengthStream(function (l) {
              file.gzipAndMin.size = l;
            }))
            .pipe(fs.createWriteStream(file.gzipAndMin.path))
            .on('finish', function () {
              callback(null);
            });
        });
    }
  ], function (err) {
    cb();
  });
}


async.series([
  function (callback) {
    // clean dist
    del('dist/*', function () {
      fs.mkdir(__dirname + '/dist/' ,function(e){
        fs.mkdir(__dirname + '/dist/results/' ,function(e){
          callback(null);
        });
      });
    });
  },
  function (callback) {
    var filesGlob = glob('files/*.html', function (er, f) {
      files = _.map(f, function(fname) {
        return {
          'source': {
            'path': __dirname + '/' + fname
          },
          'gzip': { 
            'path': __dirname + '/dist/' + getFileName(fname) + '.gz'
          },
          'min': { 
            'path': __dirname + '/dist/' + getFileName(fname.replace('.html', '.min.html'))
          },
          'gzipAndMin': { 
            'path': __dirname + '/dist/' + getFileName(fname.replace('.html', '.min.html.gz'))
          }
        };
      });
      callback(null);
    });
  },
  function (callback) {
    async.each(files, processFile, function (err) {
      callback(null);
    });
  }
], function () {
  var row;
  var header = [
    'Page', 
    'original (bytes)',
    'gzipped (bytes)', 
    'minified and gzipped (bytes)',
    'Percent Saved'
  ];

  var csvTable = [
    header
  ];

  var consoleTable = new Table({
    head: header
  });

  _.forEach(files, function (file) {
    row = [
      getFileName(file.source.path), 
      file.source.size, 
      file.gzip.size, 
      file.gzipAndMin.size, 
      calculateSavings(file)
    ];

    consoleTable.push(row);
    csvTable.push(row);
  });

  console.log(consoleTable.toString());

  fs.writeFile(__dirname + '/dist/results/results.json', JSON.stringify(files, null, 4));

  csv.stringify(csvTable, function(err, data){
    fs.writeFile(__dirname + '/dist/results/results.csv', data);
  });
});
