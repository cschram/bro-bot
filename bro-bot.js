"use strict";
var console = require("console"),
    vm = require("vm"),

    irc = require("irc"),
    CouchClient = require("couch-client"),

    config = require("./bot-config");

var VERSION = "Bro-Bot Version 0.3",
    DB = CouchClient("http://127.0.0.1:5984/bro-bot/");
    
DB.get("logs", function (err, doc) {
  if (err) {
    throw err;
  }
  
  var logs = doc,
      logsChanged = false;
  function saveLogs() {
    if (logsChanged) {
      DB.save(logs, function (e, d) {
        if (e) {
          throw e;
        }
        logs = d;
        logsChanged = false;
        console.log("Saved logs.");
      });
    }
    setTimeout(saveLogs, 60000);
  }
  setTimeout(saveLogs, 60000);
  
  var client = new irc.Client("irc.freenode.net", "bro-bot", {
    username : "bro-bot",
    channels : ["#vidyadev"]
  });
  
  var chatCount = 0;
  function clearChatCount() {
    chatCount = 0;
    setTimeout(clearChatCount, 1000);
  }
  setTimeout(clearChatCount, 1000);
  
  function say () {
    if (chatCount < 5) {
      if (arguments.length === 1) {
        logChat("[bro-bot] " + arguments[0]);
        client.say("#vidyadev", arguments[0]);
      } else if (arguments.length === 2) {
        logChat("[bro-bot] " + arguments[0] + ": " + arguments[1]);
        client.say(arguments[0], arguments[1]);
      }
      chatCount++;
    }
  };
  
  function logChat(msg) {
    logs.chat.push(msg);
    console.log(msg);
    logsChanged = true;
  }
  function logError(msg) {
    logs.error.push(msg);
    console.error(msg);
    logsChanged = true;
  }

  client.addListener("error", function (error) {
    logError(error);
  });
  
  client.addListener("motd", function (motd) {
    console.log("Connected to Freenode");
    client.say("nickserv", "identify " + config.password);
  });

  client.addListener("join#vidyadev", function (nick) {
    logChat("[" + nick + "] joined.");
  });

  client.addListener("part#vidyadev", function (nick, reason) {
    logChat("[" + nick + "] Left. (" + reason + ")");
  });

  client.addListener("message#vidyadev", function (nick, msg) {
    logChat("[" + nick + "] " + msg);
    
    if (msg[0] === "?" && msg.length > 1) {
      var args = msg.split(" "),
          command = args.shift().substr(1),
          reply;

      if (args[args.length - 2] === "@") {
        reply = args.pop() + ": ";
        args.pop();
      } else if (args[args.length - 1] === "@") {
        reply = "";
      } else {
        reply = nick + ": ";
      }

      switch (command) {
      case "version":
        reply += VERSION;
        break;
      case "google":
        reply += "http://www.google.com/#q=" + args.join("+");
        break;
      case "eval":
        var code = args.join(" ");
        code.replace(/while *\( *([\s\S]+?) *\) *\n* *\{/g, function (match, val) {
          var c = "__lc_" + String(Math.random() * 1000).substr(0, 3) + "_", n;
          n = "var "+c+"=0;"+match+""+c+"++;if("+c+">100)break;";
          code = code.replace(match, n);
        });        
        try {
          reply += vm.createScript(code).runInNewContext({});
        } catch (e) {
          reply += "Error: " + e;
        }
        break;
      case "leave-message":
        var usr = args.shift();
        if (users.contains(usr)) {
          reply += "User is already online!";
        } else {
          msg = [nick, args.join(" ")];
          if (typeof messages[usr] === "array") {
            messages[usr][messages[usr].length] = msg;
          } else {
            messages[usr] = [msg];
          }
          reply += "Left a message for " + usr + " when he/she logs on again.";
        }
        break;
      case "zalgo":
        reply = "H̹̙̦̮͉̩̗̗ͧ̇̏̊̾Eͨ͆͒̆ͮ̃͏̷̮̣̫̤̣ ̵̞̹̻̀̉̓ͬ͑͡ͅCͯ̂͐͏̨̛͔̦̟͈̻O̜͎͍͙͚̬̝̣̽ͮ͐͗̀ͤ̍̀͢M̴̡̲̭͍͇̼̟̯̦̉̒͠Ḛ̛̙̞̪̗ͥͤͩ̾͑̔͐ͅṮ̴̷̷̗̼͍̿̿̓̽͐H̙̙̔̄͜";
        break;
      case "lmgtfy":
        reply += "http://lmgtfy.com/?q=" + args.join("+");
        break;
      default:
        reply = "";
        break;
      }
      if (reply != "") {
        say(reply);
      }
    }
  });
  
  process.on("exit", function () {
    say("Bye fogots");
  });

});