var console = require("console"),
    vm = require("vm"),
    irc = require("irc"),
    CouchClient = require("couch-client"),
    config = require("./bot-config");

(function () {
"use strict";

var VERSION = "Bro-Bot Version 0.3.2",
    DB = CouchClient("http://127.0.0.1:5984/bro-bot/");
    
// Retrieve the logs from the database then start the bot
DB.get("logs", function (err, doc) {
  if (err) {
    throw "Cannot load logs: " + err;
  }
  
  var logs = doc,
      logsChanged = false,
      client,
      chatCount = 0;
      
  // Handle log saving
  // config.loginterval determines how often to save logs to the database
  function saveLogs() {
    if (logsChanged) {
      DB.save(logs, function (e, d) {
        if (e) {
          throw e;
        }
        logs = d;
        logsChanged = false;
      });
    }
    setTimeout(saveLogs, config.loginterval);
  }
  setTimeout(saveLogs, config.loginterval);
  
  // Create IRC Client
  client = new irc.Client("irc.freenode.net", "bro-bot", {
    username : "bro-bot",
    channels : [config.channel]
  });
  
  // Ensure flood control so the bot doesn't spam
  // (Don't want to get k-lined!)
  function clearChatCount() {
    chatCount = 0;
    setTimeout(clearChatCount, 1000);
  }
  setTimeout(clearChatCount, 1000);
  
  // Log chat
  function logChat(msg, noTimestamp) {
    if (!noTimestamp) {
      msg = "<small>" + (new Date()).toUTCString() + "</small> " + msg;
    }
    logs.chat.push(msg);
    console.log(msg);
    logsChanged = true;
  }
  // Log errors
  function logError(msg) {
    logs.error.push(msg);
    console.error(msg);
    logsChanged = true;
  }
  
  function say (msg) {
    if (chatCount < 5) { // flood protection
      logChat("<b>[bro-bot]></b> " + msg);
      client.say(config.channel, msg);
      chatCount += 1; // flood protection
    }
  }

  client.addListener("error", function (error) {
    logError(error);
  });
  
  client.addListener("motd", function (motd) {
    logChat("<hr>", true);
    logChat("<b><i>Connected to Freenode</i></b>");
    client.say("nickserv", "identify " + config.password);
    
  });

  client.addListener("join" + config.channel, function (nick) {
    logChat("<b>[" + nick + "]</b> joined.");
  });

  client.addListener("part" + config.channel, function (nick, reason) {
    logChat("<b>[" + nick + "]</b> Left. (" + reason + ")");
  });

  client.addListener("message" + config.channel, function (nick, msg) {
    logChat("<b>[" + nick + "]</b> " + msg);
    
    if (msg[0] === "?" && msg.length > 1) {
      var args = msg.split(" "),
          command = args.shift().substr(1),
          prefix;

      if (args[args.length - 2] === "@") {
        prefix = args.pop() + ": ";
        args.pop();
      } else if (args[args.length - 1] === "@") {
        prefix = "";
      } else {
        prefix = nick + ": ";
      }

      switch (command) {
      case "version":
        say(prefix + VERSION);
        break;
      case "search":
        say(prefix + "http://google.com/search?q=" + args.join("+") + "+site:http://vidyadev.org/");
        break;
      case "forums":
        if (args.length === 0) {
          say(prefix + "http://vidyadev.org/forums/");
        } else {
          say(prefix + "http://google.com/search?q=" + args.join("+") + "+site:http://vidyadev.org/forums/");
        }
        break;
      case "wiki":
        if (args.length === 0) {
          say(prefix + "http://vidyadev.org/wiki/");
        } else {
        say(prefix + "http://google.com/search?q=" + args.join("+") + "+site:http://vidyadev.org/wiki/");
        }
        break;
      case "logs":
        if (args.length === 0) {
          say(prefix + "http://irclogs.vidyadev.org/");
        } else {
          say(prefix + "http://irclogs.vidyadev.org/search/" + args.join("+"));
        }
        break;
      case "js":
        var code = args.join(" ");
        code.replace(/while *\( *([\s\S]+?) *\) *\n* *\{/g, function (match, val) {
          var c = "__lc_" + String(Math.random() * 1000).substr(0, 3) + "_", n;
          n = "var "+c+"=0;"+match+""+c+"++;if("+c+"]100)break;";
          code = code.replace(match, n);
        });
        try {
          say(prefix + vm.createScript(code).runInNewContext({}));
        } catch (e) {
          say(prefix + "Error: " + e);
        }
        break;
      case "lmgtfy":
        say(prefix + "http://lmgtfy.com/?q=" + args.join("+"));
        break;
      case "help":
        say(prefix + "Current commands are 'version', 'search', 'forums', 'wiki', 'logs', 'js', and 'lmgtfy'.");
        break;
        
      case "zalgo":
        say("H̹̙̦̮͉̩̗̗ͧ̇̏̊̾Eͨ͆͒̆ͮ̃͏̷̮̣̫̤̣ ̵̞̹̻̀̉̓ͬ͑͡ͅCͯ̂͐͏̨̛͔̦̟͈̻O̜͎͍͙͚̬̝̣̽ͮ͐͗̀ͤ̍̀͢M̴̡̲̭͍͇̼̟̯̦̉̒͠Ḛ̛̙̞̪̗ͥͤͩ̾͑̔͐ͅṮ̴̷̷̗̼͍̿̿̓̽͐H̙̙̔̄͜");
        break;
      }
    }
  });

});

}());