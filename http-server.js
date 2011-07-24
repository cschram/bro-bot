var console   = require("console"),
    express   = require("express"),
    utemplate = require("./utemplate");

var indexTemplate  = new utemplate.Template("templates/index.html"),
    logsTemplate   = new utemplate.Template("templates/page.html"),
    searchTemplate = new utemplate.Template("templates/search.html");

module.exports.start = function (logs, bot) {
  "use strict";
  var app = express.createServer(
        express.bodyParser(),
        express.errorHandler()
      );
  
  app.get("/", function (req, res) {
    indexTemplate.render({static_dir : "http://bot.vidyadev.org/static"}, function (err, data) {
      if (err) {
        res.send(err);
      } else {
        res.send(data);
      }
    });
  });
  
  app.get("/logs/:page?", function (req, res) {
    var pageCount = parseInt(logs.chat.length / 100),
        page, start, lines;
    
    if (req.params.page === "all") {
      lines = logs.chat;
    } else if (req.params.page === "errors") {
      lines = logs.errors;
    } else {
      if (req.params.page) {
        page = parseInt(req.params.page, 10);
      } else {
        page = 1;
      }
      
      if (page > pageCount) {
        lines = ["<h1>Page Not Fount</h1>"];
      } else {
        start = (logs.chat.length < (page * 100)) ? 0 : logs.chat.length - (page * 100);
        lines = logs.chat.slice(start, start + 100);
      }
    }
    logsTemplate.render({
      static_dir : "http://bot.vidyadev.org/static",
      "page" : page,
      new_page : page - 1,
      old_page : page + 1,
      page_count : pageCount,
      "lines" : lines
    }, function (err, data) {
      if (err) {
        console.error(err);
        res.send(err);
      } else {
        res.send(data);
      }
    });
  });

  app.get("/logs/search/:terms", function (req, res) {
    var term = req.params.terms.split("+").join(" "), lines = [];
        
    for (var i = 0; i < logs.chat.length; i++) {
      if (logs.chat[i].indexOf(term) > -1) {
        lines.push(logs.chat[i]);
      }
    }
    
    searchTemplate.render({
      static_dir : "http://bot.vidyadev.org/static",
      "lines" : lines
    }, function (err, data) {
      if (err) {
        console.error(err);
        res.send(err);
      } else {
        res.send(data);
      }
    });
  });
  
  app.post("/github/postreceive", function (req, res) {
    var payload = JSON.parse(req.body.payload),
        commit;
    bot.say("#vidyadev", "Push to GitHub Repository " + payload.repository.name
      + "<" + payload.repository.url + ">");
    for (var i = 0; i < payload.commits.length; i++) {
      commit = payload.commits[i];
      bot.say("#vidyadev", 'Commit: "' + commit.message + '" <' + commit.url + ">");
    }
  });
  
  // Serve Static Content
  app.get('/static/:dir/:subdir?/:file', function (req, res) {
    var file = "static/" + req.params.dir + "/";
    if (req.params.subdir) {
      file = file + req.params.subdir + '/' + req.params.file;
    } else {
      file = file + req.params.file;
    }
    res.sendfile(file);
  });
  
  app.listen(80);
  console.log("HTTP Server Running on Port 80");
};