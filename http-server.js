var console = require("console"),
    express = require("express");

module.exports.start = function (logs, bot) {
  "use strict";
  var app    = express.createServer(),
      header = '<!doctype html><html><head><meta charset="utf-8"></head><body>',
      footer = "</body></html>";

  app.use(express.bodyParser());
  
  app.get("/", function (req, res) {
    res.send(header + 'Bro-Bot is an IRC Bot for #vidyadev that does many useful things like <a href="logss/">logging</a>.' + footer);
  });
  
  app.get("/logs/:page?", function (req, res) {
    var result = header, 
        pageCount = parseInt(logs.chat.length / 100),
        page, start;
    
    if (req.params.page === "all") {
      for (var i = 0; i < logs.chat.length; i++) {
        result += logs.chat[i] + "<br>";
      }
    } else if (req.params.page === "errors") {
      for (var i = 0; i < logs.errors.length; i++) {
        result += logs.errors[i] + "<br>";
      }
    } else {
      if (req.params.page) {
        page = parseInt(req.params.page, 10);
      } else {
        page = 1;
      }
      
      result += '<div style="width:100%;">';
      if (page > 1) {
        result += '<a href="http://bot.vidyadev.org/logs/' + (page - 1) + '" style="float:left;">&lt;&lt; Newer</a>';
      }
      if (page < pageCount) {
        result += '<a href="http://bot.vidyadev.org/logs/' + (page + 1) + '" style="float:right;">Older &gt;&gt;</a>';
      }
      result += '</div><div style="clear:both;"></div><hr>';
      
      if (page > pageCount) {
        result += "<h1>Page Not Fount</h1>";
      } else {
        start = (logs.chat.length < (page * 100)) ? 0 : logs.chat.length - (page * 100);
        for (var i = start; i < (start + 100); i++) {
          result += logs.chat[i] + "<br>";
        }
      }
      
      result += '<hr><div style="width:100%;">';
      if (page > 1) {
        result += '<a href="http://bot.vidyadev.org/logs/' + (page - 1) + '" style="float:left;">&lt;&lt; Newer</a>';
      }
      if (page < pageCount) {
        result += '<a href="http://bot.vidyadev.org/logs/' + (page + 1) + '" style="float:right;">Older &gt;&gt;</a>';
      }
      result += '</div><div style="clear:both;"></div>';
    }
    
    result += footer;
    res.send(result);
  });

  app.get("/logs/search/:terms", function (req, res) {
    var result = header + '<h1>Search for "' + req.params.terms + '"</h1><ul>',
        term = req.params.terms.split("+").join(" ");
        
    for (var i = 0; i < logs.chat.length; i++) {
      if (logs.chat[i].indexOf(term) > -1) {
        result += "<li>" + logs.chat[i]; + "</li>";
        break;
      }
    }
    
    result += "</ul>" + footer;
    res.send(result);
  });
  
  app.post("/github/postreceive", function (req, res) {
    var commit;
    /*bot.say("#vidyadev", "Push to GitHub Repository " + req.body.repository.name
      + "<" + req.body.respository.url + "> (" + req.body.repository.owner.name + ")");
    for (var i = 0; i < req.body.commits.length; i++) {
      commit = req.body.commits[i];
      bot.say("#vidyadev", "Commit " + commit.id + ": '" + commit.message + "' at "
        + commit.timestamp + " by " + commit.author.name + " <" + commit.url + ">");
    }*/
    bot.say("#vidyadev", "Test GitHub Post-Receive Hook: " + JSON.stringify(req.body));
  });
  
  app.listen(80);
  console.log("HTTP Server Running on Port 80");
};