"use strict";
var util = require("util"),
    fs = require("fs"),
    vm = require("vm"),
    spawn = require("child_process").spawn,

    irc = require("irc"),

    config = require("./bot-config");

var VERSION = "Bro-Bot Version 0.2.3";
var chan = "#vidyadev";
var logFileName = "vidyadev.txt";
var errorFileName = "errors.txt";

var logf = fs.createWriteStream(logFileName, {"flags" : "a"});
var errf = fs.createWriteStream(errorFileName, {"flags" : "a"});

Array.prototype.contains = function (val) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === val) {
      return true;
    }
  }
  return false;
};

Array.prototype.remove = function (val) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === val) {
      this.splice(i, 1);
    }
  }
};

var log = function (msg) {
  logf.write(msg + "\n");
  util.log(msg);
  return "Logged: " + msg;
};

var users = [];
var messages = {};

log("\n");

var client = new irc.Client("irc.freenode.net", "bro-bot", {
  username : "bro-bot",
  channels : [chan]
});
var say = function () {
  if (arguments.length === 1) {
    log("[bro-bot] " + arguments[0]);
    client.say(chan, arguments[0]);
  } else if (arguments.length === 2) {
    log("[bro-bot] " + arguments[0] + ": " + arguments[1]);
    client.say(arguments[0], arguments[1]);
  }
};

client.addListener("error", function (msg) {
    log("[Error]" + msg.command + ": " + msg.args.join(" "));
});

client.addListener("motd", function (motd) {
  log("Connected to Freenode");
  client.say("nickserv", "identify " + config.password);
});

client.addListener("join" + chan, function (nick) {
  log("[" + nick + "] joined.");
  if (nick !== "bro-bot") {
    if (!users.contains(nick)) {
      users[users.length] = nick;
    }        
    if (typeof messages[nick] === "array") {
      say(nick + ": You have " + messages[nick].length + " message(s).");
      for (var i = 0; i < messages[nick].length; i++) {
        say(nick + ": From " + messages[nick][0] + ": " + messages[nick][1]);
      }
    }
  }
});

client.addListener("names", function (channel, nicks) {
  if (channel === chan) {
    for (var nick in nicks) {
      users[users.length] = nick;
    }
  }
});

client.addListener("part" + chan, function (nick, reason) {
  if (users.contains(nick)) {
    users.remove(nick);
  }
});

client.addListener("message" + chan, function (nick, msg) {
  log("[" + nick + "] " + msg);
  if (msg.indexOf("?debug") === 0) {
    var args = msg.split(" ");
    args.shift();
    switch (args[0]) {
    case "users":
      say(nick, users);
      break;
    case "messages":
      say(nick, JSON.stringify(messages));
      break;
    }
  } else if (msg[0] === "?" && msg.length > 1) {
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
    case "logs":
      reply += "http://dl.dropbox.com/u/9227379/bro-bot/" + logFileName;
      break;
    case "vidyadev":
      reply += "http://vidyadev.org/";
      break;
    case "forums":
      reply += "http://vidyadev.org/forums/";
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
        errf.write(e);
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
    case "help":
      reply += "Current Commands are version, logs, vidyadev, forums, google, leave-message, and eval.";
      break;
    }
    say(reply);
  }
});

client.addListener("pm", function (nick, msg) {
  say(nick, "fuq awf");
});

process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (data) {
  say(data);
});