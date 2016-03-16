'use strict';

/**
 * Module dependencies.
 * @private
 */
var torrentStream = require('torrent-stream');
var express = require('express');
var mime = require('mime');
var filesize = require('file-size');
var path = require('path')
  , join = path.join;

var app = express();

//Usefull if we are fetching a specific file in a already open torrent
var currentLink = null;
var currentEngine = null;


//Works like serveIndex but do not search in a path but in a torrent
function serveTorrentIndex() {
  return function (req, res) {
    console.log('request recieved', req.path, req.url);
    try {
      //@temp cause magnet link is now after localhost:3000/
      var link = req.url.substr(1);
      var splitedLink = link.split('&');
      var lastElt = splitedLink[splitedLink.length - 1];
      var forceDownload = false;

      if(lastElt.substr(0, 6) === 'force=') {
        forceDownload = true;
        splitedLink.pop();
        lastElt = splitedLink[splitedLink.length - 1];
      }

      console.log('lastElt', lastElt);
      var index = null;
      //If we are looking for a file inside the torrent
      if(lastElt.substr(0, 4) === 'ind=') {
        index = lastElt.substr(4);
        splitedLink.pop();
        link = splitedLink.join('&');
        console.log('searching for file index', index);
      }

      var engine = null;
      if(link === currentLink && currentEngine != null) {
        console.log('current torrent finded', currentLink);
        engine = currentEngine;
        //Avoid to create the torrentStream again
        serveFiles(req, res, engine.files, index, currentLink, forceDownload);
      }
      else {
        console.log('new torrent at link', link);
        engine = torrentStream(link);
        currentLink = link;
        currentEngine = engine;
      }
    } catch (err) {
      res.statusCode = 404;
      res.end('Invalid torrent identifier : ' + link);
      console.error(err);
      console.error(req.url);
      return;
    }

    engine.on('ready', function(){
      serveFiles(req, res, engine.files, index, currentLink, forceDownload);
    });
  }
}

function serveFiles(req, res, files, index, link, forceDownload) {
  if(files.length > 1 && index === null)
    serveHtmlFileList(req, res, files, link);
  else if(files.length === 1 || index !== null) {
    var ind = files.length === 1 ? 0 : index;
    serveTorrentFile(req, res, files[ind], forceDownload);
  }
  else {
    res.statusCode = 404;
    res.end('No files in this torrent'); 
  }
}

function serveHtmlFileList(req, res, files, link){
  var torrentName = files[0].path.split('/')[0];
  console.log('serving html file list for torrent', torrentName);

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + torrentName + '"</title></head><body>';
  html += '<h1>' + torrentName + '</h1>';
  html += '<ul>';

  files.forEach(function(file, index){
    html += '<li>';
      html += '<a href="./' + link + '&ind=' + index + '">' + file.name + ' - ' + filesize(file.length).human() + '</a>';
      html += ' (<a href="./' + link + '&ind=' + index + '&force=1">download</a>)';
    html += '</li>';
  });

  html += '</ul></body></html>';

  var buf = new Buffer(html, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

function serveTorrentFile(req, res, file, forceDownload){
  var stream = file.createReadStream();
  var contentType = mime.lookup(file.name);
  console.log('serving ', file.name, 'with mime type', contentType);

  res.setHeader('Content-Type', contentType+'; charset=utf-8');
  if(forceDownload)
    res.setHeader('Content-Disposition', 'attachment; filename="' + file.name + '"');
  res.setHeader('Content-Length', file.length);
  stream.pipe(res);
}

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
  //app.use(express.static('.'));
  //app.use('/', serveIndex('.', {'icons': true}))
  //app.use('/*', serveTorrentIndex({'icons': true}));
  app.get('/*', serveTorrentIndex());
});

//Sintel magnet link
//magnet:?xt=urn:btih:022692d131d3a44d770b38498022dffc9769104d&dn=Sintel.2010.Theora.Ogv-VODO