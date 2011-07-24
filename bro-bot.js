var console = require("console"),
    vm      = require("vm"),
    irc     = require("irc"),
    Sofa    = require("sofa"),
    config  = require("./config")
    server  = require("./http-server");

(function () {
"use strict";

var VERSION = "Bro-Bot Version 0.8.1",
    Server  = new Sofa.Server({ host : "127.0.0.1" }),
    DB      = new Sofa.Database(Server, "bro-bot"),
    JSENV   = {
      peen : function (len) {
        if (typeof len == "undefined") {
          len = 4;
        }
        
        if (typeof len === "string") {
          len = len.toLowerCase();
          if (len === "poisonarms") {
            return "8=D";
          } else if (len === "abjorn") {
            return JSENV.peen(100);
          } else if (len === "chuck-norris") {
            return "(('))";
          } else if (len === "haz") {
            return "8===>~~<===8";
          } else {
            return "no pen0r";
          }
        } else {
          if (len > 100) {
            return "You wish, buddy.";
          }
          var res = "8";
          for (var i = 0; i < len; i++) {
            res = res + "=";
          }
          res = res + "D";
          return res;
        }
      }
    };
    
// http://james.padolsey.com/javascript/removing-comments-in-javascript/
function removeComments(str) {
    str = ('__' + str + '__').split('');
    var mode = {
        singleQuote: false,
        doubleQuote: false,
        regex: false,
        blockComment: false,
        lineComment: false,
        condComp: false 
    };
    for (var i = 0, l = str.length; i < l; i++) {
 
        if (mode.regex) {
            if (str[i] === '/' && str[i-1] !== '\\') {
                mode.regex = false;
            }
            continue;
        }
 
        if (mode.singleQuote) {
            if (str[i] === "'" && str[i-1] !== '\\') {
                mode.singleQuote = false;
            }
            continue;
        }
 
        if (mode.doubleQuote) {
            if (str[i] === '"' && str[i-1] !== '\\') {
                mode.doubleQuote = false;
            }
            continue;
        }
 
        if (mode.blockComment) {
            if (str[i] === '*' && str[i+1] === '/') {
                str[i+1] = '';
                mode.blockComment = false;
            }
            str[i] = '';
            continue;
        }
 
        if (mode.lineComment) {
            if (str[i+1] === '\n' || str[i+1] === '\r') {
                mode.lineComment = false;
            }
            str[i] = '';
            continue;
        }
 
        if (mode.condComp) {
            if (str[i-2] === '@' && str[i-1] === '*' && str[i] === '/') {
                mode.condComp = false;
            }
            continue;
        }
 
        mode.doubleQuote = str[i] === '"';
        mode.singleQuote = str[i] === "'";
 
        if (str[i] === '/') {
 
            if (str[i+1] === '*' && str[i+2] === '@') {
                mode.condComp = true;
                continue;
            }
            if (str[i+1] === '*') {
                str[i] = '';
                mode.blockComment = true;
                continue;
            }
            if (str[i+1] === '/') {
                str[i] = '';
                mode.lineComment = true;
                continue;
            }
            mode.regex = true;
 
        }
 
    }
    return str.join('').slice(2, -2);
}

// Retrieve the logs from the database then start the bot
DB.get("logs", function (doc) {
  var logs        = doc,
      logsChanged = false,
      chatCount   = 0,
      client, karma, messages;
      
  DB.get("karma", function (doc) {
    karma = doc;
  });
  DB.get("messages", function (doc) {
    messages = doc;
  });
  
  // Handle log saving
  // config.loginterval determines how often to save logs to the database
  function saveLogs() {
    if (logsChanged) {
      DB.save(logs, function (res) {
        if (res.ok) {
          logsChanged = false;
        }
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
    msg = "<small>" + (new Date()).toUTCString() + "</small> " + msg;
    logs.errors.push(msg);
    console.error(msg);
    logsChanged = true;
  }
  
  function say (msg) {
    if (chatCount < 5) { // flood protection
      logChat('<span class="irc-bot">[bro-bot]</span> ' + msg);
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
    // In case Bro-Bot gets disconnected
    if (nick === "bro-bot") {
      client.join("#vidyadev");
      client.say("nickserv", "ghost bro-bot " + config.password);
      client.say("#vidyadev", "/nick bro-bot");
      client.say("nickserv", "identify " + config.password);
    }
  });

  client.addListener("message" + config.channel, function (nick, msg) {
    logChat('<span class="irc-nick">[' + nick + "]</span> " + msg);
    
    // Check for messages left for the user
    if (messages[nick.toLowerCase()] && messages[nick.toLowerCase()].length > 0) {
      var userMessages = messages[nick.toLowerCase()];
      for (var i = 0; i < userMessages.length; i++) {
        say(nick + ": " + userMessages[i].sender + " said \"" + userMessages[i].message + "\"");
      }
      messages[nick.toLowerCase()] = [];
    }
    
    if (msg[0] === "?" && msg.length > 1) {
      var args = msg.split(" "),
          command = args.shift().substr(1),
          prefix, toAnotherUser = false;

      if (args[args.length - 2] === "@") {
        toAnotherUser = true;
        prefix = args.pop() + ": ";
        args.pop();
      } else if (args[args.length - 1] === "@") {
        prefix = "";
      } else {
        prefix = nick + ": ";
      }

      switch (command) {
      // Return the current Bro-Bot Version
      case "version":
        say(prefix + VERSION);
        break;
        
      // Search the Vidya Dev Website
      case "search":
        say(prefix + "http://google.com/search?q=" + args.join("+") + "+site:http://vidyadev.org/");
        break;
        
      // Search the Vidya Dev Forums
      case "forums":
        if (args.length === 0) {
          say(prefix + "http://vidyadev.org/forums/");
        } else {
          say(prefix + "http://google.com/search?q=" + args.join("+") + "+site:http://vidyadev.org/forums/");
        }
        break;
        
      // Search the Vidya Dev Wiki
      case "wiki":
        if (args.length === 0) {
          say(prefix + "http://vidyadev.org/wiki/");
        } else {
          say(prefix + "http://vidyadev.org/wiki/?search=" + args.join("+"));
        }
        break;
        
      // Search the C++ Docs
      case "cpp":
        if (args.length === 0) {
          say(prefix + "http://cplusplus.com");
        } else {
          say(prefix + "http://cplusplus.com/search.do?q=" + args.join("+"));
        }
        break;
        
      // Search the Python Docs
      case "python":
        if (args.length === 0) {
          say(prefix + "http://python.org");
        } else {
          say(prefix + "http://docs.python.org/search.html?q=" + args.join("+"));
        }
        break;
        
      // Search MSDN
      case "msdn":
        if (args.length === 0) {
          say(prefix + "http://msdn.microsoft.com/library/default.aspx");
        } else {
          say(prefix + "http://social.msdn.microsoft.com/Search/en-us?query=" + args.join("+"));
        }
        break;
      
      // Search the SDL Docs
      case "sdl":
        if (args.length === 0) {
          say(prefix + "http://www.libsdl.org");
        } else {
          say(prefix + "http://www.libsdl.org/cgi/docwiki.cgi/FrontPage?action=fullsearch&value=" + args.join("+"));
        }
        break;
      
      // Search the SFML Docs
      case "sfml":
        if (args.length === 0) {
          say(prefix + "http://www.sfml-dev.org/");
        } else {
          say(prefix + "http://google.com/?q=" + args.join("+") + "+site:http://www.sfml-dev.org/documentation/1.6/");
        }
        break;
      
      // Search the Boost Docs
      case "boost":
        if (args.length === 0) {
          say(prefix + "http://www.boost.org/");
        } else {
          say(prefix + "http://google.com/?q=" + args.join("+") + "+site:http://www.boost.org/doc/libs/1_46_1/");
        }
        break;
        
      // Search the IRC Logs
      case "logs":
        if (args.length === 0) {
          say(prefix + "http://bot.vidyadev.org/logs/");
        } else {
          say(prefix + "http://bot.vidyadev.org/logs/search/" + args.join("+"));
        }
        break;
        
      // Run a JavaScript Statement
      case "js":
        var code = removeComments(args.join(" ")),
            doRun = true;
        if (code.indexOf("eval") > -1) {
          say(prefix + "Fuck off with your eval.");
          doRun = false;
        }
        if (code.match(/while *\( *([\s\S]+?) *\)/g)) {
          if (code.match(/while *\( *([\s\S]+?) *\) *\n* *\{/g)) {
            code.replace(/while *\( *([\s\S]+?) *\) *\n* *\{/g, function (match, val) {
              var c = "__lc_" + String(Math.random() * 1000).substr(0, 3) + "_", n;
              n = "var "+c+"=0;"+match+""+c+"++;if("+c+">100)break;";
              code = code.replace(match, n);
            });
          } else {
            say(prefix + "Fuck off with your while loops.");
            doRun = false;
          }
        }
        if (code.match(/for *\( *([\s\S]+?) *\)/g)) {
          if (code.match(/for *\( *([\s\S]+?) *\) *\n* *\{/g)) {
            code.replace(/for *\( *([\s\S]+?) *\) *\n* *\{/g, function (match, val) {
              var c = "__lc_" + String(Math.random() * 1000).substr(0, 3) + "_", n;
              n = "var "+c+"=0;"+match+""+c+"++;if("+c+">100)break;";
              code = code.replace(match, n);
            });
          } else {
            say(prefix + "Fuck off with your for loops.");
            doRun = false;
          }
        }
        if (doRun) {
          try {
            var result = vm.createScript(code).runInNewContext(Object.create(JSENV));
            if (typeof result === "undefined") {
              result = "undefined";
            } else if (typeof result === "function") {
              result = Object.prototype.toString.call(result);
            } else {
              result = result.toString();
            }
            say(prefix + result);
          } catch (e) {
            say(prefix + e.toString());
          }
        }
        break;
        
      // Let Me Google That For You
      case "lmgtfy":
        say(prefix + "http://lmgtfy.com/?q=" + args.join("+"));
        break;
        
      // Return the Karma of a User
      case "karma":
        if (args.length > 0) {
          var name = args[0].toLowerCase();
          if (karma[name]) {
            say(prefix + karma[name]);
          } else {
            say(prefix + "0");
          }
        } else {
          say(prefix + "shit nigger wtf r u doin");
        }
        break;
        
      //// Get help on Commands ////
      case "help":
        if (args.length === 0) {
          say(prefix + "Current commands are 'search', 'forums', 'wiki', 'logs', 'cpp', 'python', 'msdn', 'sdl', 'sfml', 'boost', 'js', 'karma', and 'lmgtfy'.");
        } else {
          switch (args[0]) {
          case "search":
            say(prefix + "Format: ?search <terms>");
            say(prefix + "This will search Google through the site vidyadev.org");
            break;
          case "forums":
            say(prefix + "Format: ?forums <terms>");
            say(prefix + "This will search the Vidya Dev forums");
            break;
          case "wiki":
            say(prefix + "Format: ?wiki <terms>");
            say(prefix + "This will search the Vidya Dev wiki");
            break;
          case "logs":
            say(prefix + "Format: ?logs <terms>");
            say(prefix + "This will search the IRC Logs for #vidyadev");
            break;
          case "cpp":
            say(prefix + "Format: ?cpp <terms>");
            say(prefix + "This will search the C++ Documentation");
            break;
          case "python":
            say(prefix + "Format: ?python <terms>");
            say(prefix + "This will search the Python Documentation");
            break;
          case "msdn":
            say(prefix + "Format: ?msdn <terms");
            say(prefix + "This will search the MSDN");
            break;
          case "sdl":
            say(prefix + "Format: ?sdl <terms>");
            say(prefix + "This will search the SDL Documentation");
            break;
          case "sfml":
            say(prefix + "Format: ?sfml <terms>");
            say(prefix + "This will search the SFML Documentation");
            break;
          case "boost":
            say(prefix + "Format: ?boost <terms>");
            say(prefix + "This will search the Boost Documentation");
            break;
          case "js":
            say(prefix + "Format: ?js <statement>");
            say(prefix + "This will run a JavaScript statement and return the result");
            break;
          case "karma":
            say(prefix + "Format: ?karma <user>");
            say(prefix + "This will give you the karma of the user. Karma is increased whenever someone says <username>++");
            break;
          case "lmgtfy":
            say(prefix + "Format: ?lmgtfy <terms");
            say(prefix + "This will return a Let Me Google That For You search");
            break;
          }
        }
        break;
      //// End of Help ////
        
      // Special commands OMG
      case "zalgo":
        if (toAnotherUser) {
          say(prefix + "H̜͇̹̜̦ͥ̿͒̈͆͌͛̅̔ͥ̊ͧͭ̇̄̓̚̚̕Ȩ̶̶͕͉̙͔̥͎͉̘̟̃̇̆̿̔ͭ̆̔̍͒͛͊ͮ͢ͅ ͤͣ̎̇̉̑ͬ͌͗̏̽̑ͨ̀͒҉̯͉̰̗͚͉̱̟͈͇̮̼̜̰͟͟ͅC̵̞̤̟͈̺̰͇̥͎̤͖̣̻̺̠̃͒́̂̀̿͋͌̆ͥ͌̒̑ͅO̢̰̩͉̫͉̺̼͇̻̯̥̱̙̭̼̊ͭͪ͌ͥ͒̆͆ͯ̿̆̆̚͟͞M̢͈̜̺̺ͤ̃̎ͥͨ̈́ͩ͗̿͊ͪ͗̔ͬ̾̓̊̚E̸̸͉̬͖̩͔̼͔̩̗̝͙̼͕̪̜̺͓͑͛̌̏͊͢͝͠Ţ̵̵̖̘̤͈̬͕̫̘̠̩̝̼̑̊̇͛͋Ḧ̴̸̢͓̯̖̟̙̘̣̳̮̤̙̱͓̦́ͦͪ̍ͬ̽̃͗̏̑");
        } else {
          say("H̜͇̹̜̦ͥ̿͒̈͆͌͛̅̔ͥ̊ͧͭ̇̄̓̚̚̕Ȩ̶̶͕͉̙͔̥͎͉̘̟̃̇̆̿̔ͭ̆̔̍͒͛͊ͮ͢ͅ ͤͣ̎̇̉̑ͬ͌͗̏̽̑ͨ̀͒҉̯͉̰̗͚͉̱̟͈͇̮̼̜̰͟͟ͅC̵̞̤̟͈̺̰͇̥͎̤͖̣̻̺̠̃͒́̂̀̿͋͌̆ͥ͌̒̑ͅO̢̰̩͉̫͉̺̼͇̻̯̥̱̙̭̼̊ͭͪ͌ͥ͒̆͆ͯ̿̆̆̚͟͞M̢͈̜̺̺ͤ̃̎ͥͨ̈́ͩ͗̿͊ͪ͗̔ͬ̾̓̊̚E̸̸͉̬͖̩͔̼͔̩̗̝͙̼͕̪̜̺͓͑͛̌̏͊͢͝͠Ţ̵̵̖̘̤͈̬͕̫̘̠̩̝̼̑̊̇͛͋Ḧ̴̸̢͓̯̖̟̙̘̣̳̮̤̙̱͓̦́ͦͪ̍ͬ̽̃͗̏̑");
        }
        break;
      case "flip":
        if (toAnotherUser) {
          say(prefix + "(╯‵Д′)╯彡┻━┻)ﾟДﾟ)彡☆");
        } else {
          say("(╯‵Д′)╯彡┻━┻)ﾟДﾟ)彡☆");
        }
        break;
      case "cthulhu":
        if (toAnotherUser) {
          say(prefix + "P̷̹͍͙̬̗̠̗͍̯ͭ̅̓͛̐͊͋̉͝ĥ̵̡̢̪̜̙̣̬ͥ͆͂͛̌ͫ̾ͬ'̝̥̻̮̻̳̮͚̔̉̍ͥ̏̇̈́͞n̜̜͕̿͒́ͧͮ̎͘g̨̻̰͖̮ͣ̽̒͂ͯ̉̀͜l̰̞̦͈̪̣̙̐̈́ͭ̉ͯ͌u̵̲͍̗̪̓ͦͩ̂́͆͗͘i͖̜͚̦̗ͤͨ̊ͧ̀̓̓ ̩̳̙̞̭͒͊̓ͣ̿̾͠͠m͂̊̃̅͏̻̹̰̲͚̰̕g̡̺̜̭̣̏̓ͭ̇͛͋ͫͨ́͞lͪͨ̆ͣ͏̜͔̝̱̭̦̰ẉ̴̘̪̙̹͖̤̭͗̿ͤ̉ͅ'̢̞̪̪̤͕̩͐̎́ņ̵̳̟͕̗̫̒͋ͭ̑̚ͅa̮̯̗̙̜̻̻̣̿̒̒̓̑͆̄͂͡f͓̖̺̭̯̤̋͒ͩ̈͛͗̕͡h̻̖̹͓̯̘̟̱̟ͧͬ ̭̣̝̹̰͛̐ͩ̅͐͆͒̿͠C͙̦̥̬ͪ̒ͫ͐̄͜͟͠ṱ̷͖͇͈ͫͫ͋̉̾͋͐͆h̭͓̥̲̣̤̍͂͆́̈́ͫ̚u͔̙̩͇͕̲ͦͮ́͐ͭ̌͘ḻ̷̰̣̗̺̹̫̱̀͐̀̐̆ͤh͒̿̂ͪ͋͂͞͏̹͎͖͓̣̟̭͖͕u͊̌̎͋͛͆ͤ̋̆͟͡͏̯̗͖͓̗ ̜̩̗̜̲͊ͤ̉R̩̟̯̲ͭ̽̄́̽'̩̰̥͕͖̞̈́̄͛̄͂̉̕͠ͅl̝ͥͧy̴̼̘͙̽̈́̒ͩ̚̚̕͝ȩ͕̹͔̬̺͚̣̓͗ͥ̑ͣͤͧ́ḩ̰̪̜̦̼̭̯̮̀̀ͪ ̢̡̘͓̫̠̼̖͍̺̲͐̋̿ͬ̇̿͌ͫw̢̘̟̭̭̬̄ͤ̉ͦͮͧ́͝g̨̝̦͔͔̠̦̪ͧ̽͌ͧ̂͟͠ͅa̴̡̻̱̍ͩ̌̔̀ͅĥ̻͖̫̤͕̝͉̣ͤ̓ͩ͟ͅ'͈̭̤͍̻͔̼̟̘̓̐̀͘n̷̼͔̘̱͔̯̘̜̾̀͊͋̆̉͝a̞ͬͫ͌͐͂̀͒̀̕ĝ̦̣͈͚̦̝̜ͪl̫͚͛ͩ̈́̍́͞ ̬̗̜̗̞̘ͭ̍͡͠͝f̡̘̙̊̂ͥ̑͑̈̔̿͠h̵̠͓̙̦̹̝ͩ̿ͫ̐̂̄ͥͅt̵̻͓̠̰̖̖ͤͥ̂ͩͬ̾̚̕͝a̙͕̩͖̳̫̩͚ͪ͒̋ͩ̀g̞̱̲̔n̓̓͏̩̳̦ͅ");
        } else {
          say("P̷̹͍͙̬̗̠̗͍̯ͭ̅̓͛̐͊͋̉͝ĥ̵̡̢̪̜̙̣̬ͥ͆͂͛̌ͫ̾ͬ'̝̥̻̮̻̳̮͚̔̉̍ͥ̏̇̈́͞n̜̜͕̿͒́ͧͮ̎͘g̨̻̰͖̮ͣ̽̒͂ͯ̉̀͜l̰̞̦͈̪̣̙̐̈́ͭ̉ͯ͌u̵̲͍̗̪̓ͦͩ̂́͆͗͘i͖̜͚̦̗ͤͨ̊ͧ̀̓̓ ̩̳̙̞̭͒͊̓ͣ̿̾͠͠m͂̊̃̅͏̻̹̰̲͚̰̕g̡̺̜̭̣̏̓ͭ̇͛͋ͫͨ́͞lͪͨ̆ͣ͏̜͔̝̱̭̦̰ẉ̴̘̪̙̹͖̤̭͗̿ͤ̉ͅ'̢̞̪̪̤͕̩͐̎́ņ̵̳̟͕̗̫̒͋ͭ̑̚ͅa̮̯̗̙̜̻̻̣̿̒̒̓̑͆̄͂͡f͓̖̺̭̯̤̋͒ͩ̈͛͗̕͡h̻̖̹͓̯̘̟̱̟ͧͬ ̭̣̝̹̰͛̐ͩ̅͐͆͒̿͠C͙̦̥̬ͪ̒ͫ͐̄͜͟͠ṱ̷͖͇͈ͫͫ͋̉̾͋͐͆h̭͓̥̲̣̤̍͂͆́̈́ͫ̚u͔̙̩͇͕̲ͦͮ́͐ͭ̌͘ḻ̷̰̣̗̺̹̫̱̀͐̀̐̆ͤh͒̿̂ͪ͋͂͞͏̹͎͖͓̣̟̭͖͕u͊̌̎͋͛͆ͤ̋̆͟͡͏̯̗͖͓̗ ̜̩̗̜̲͊ͤ̉R̩̟̯̲ͭ̽̄́̽'̩̰̥͕͖̞̈́̄͛̄͂̉̕͠ͅl̝ͥͧy̴̼̘͙̽̈́̒ͩ̚̚̕͝ȩ͕̹͔̬̺͚̣̓͗ͥ̑ͣͤͧ́ḩ̰̪̜̦̼̭̯̮̀̀ͪ ̢̡̘͓̫̠̼̖͍̺̲͐̋̿ͬ̇̿͌ͫw̢̘̟̭̭̬̄ͤ̉ͦͮͧ́͝g̨̝̦͔͔̠̦̪ͧ̽͌ͧ̂͟͠ͅa̴̡̻̱̍ͩ̌̔̀ͅĥ̻͖̫̤͕̝͉̣ͤ̓ͩ͟ͅ'͈̭̤͍̻͔̼̟̘̓̐̀͘n̷̼͔̘̱͔̯̘̜̾̀͊͋̆̉͝a̞ͬͫ͌͐͂̀͒̀̕ĝ̦̣͈͚̦̝̜ͪl̫͚͛ͩ̈́̍́͞ ̬̗̜̗̞̘ͭ̍͡͠͝f̡̘̙̊̂ͥ̑͑̈̔̿͠h̵̠͓̙̦̹̝ͩ̿ͫ̐̂̄ͥͅt̵̻͓̠̰̖̖ͤͥ̂ͩͬ̾̚̕͝a̙͕̩͖̳̫̩͚ͪ͒̋ͩ̀g̞̱̲̔n̓̓͏̩̳̦ͅ");
        }
        break;
      case "trout":
        if (nick === "abjorn") {
          say("/me slaps " + args[0] + " around with a large trout.");
        }
        break;
      }
    } else {
      // Karma system
      if (msg.substr(-2, 2) === "++") {
        var name = msg.substr(0, msg.length - 2).toLowerCase();
        if (name.split(" ").join("") === name) {
          if (name !== nick.toLowerCase()) {
            if (karma[name]) {
              karma[name]++;
            } else {
              karma[name] = 1;
            }
            DB.save(karma, function (res) {
              if (!res.ok) {
                logError(res.error);
              }
            });
          } else {
            say(nick + ": Nice try, faggot.");
          }
        }
      } else {
        var tokens = msg.split(" ");
        switch (tokens[0]) {
        case "bro-bot:":
          if (tokens[1].toLowerCase() === "tell" && tokens.length > 3) {
            // leave messages
            var name = tokens[2].toLowerCase(),
                newMessage = tokens.slice(1).join(" ");
            if (typeof messages[name] === "undefined") {
              messages[name] = [];
            }
            messages[name].push({
              sender : nick,
              message : newMessage
            });
            DB.save(messages, function (res) {
              if (res.ok) {
                say(nick + ": Okay");
              } else {
                logError(res.error);
              }
            });
          }
          break;
        case ">":
          if (msg.substr(0, 10) === "> implying") {
            say(">implying " + nick + " isn't a faggot");
          }
          break;
        case ">implying":
          say(">implying " + nick + " isn't a faggot");
          break;
        }
      }
    }
  });
  
  client.addListener("pm", function (nick, msg) {
    if (nick.toLowerCase() === "abjorn") {
      if (msg[0] === "?" && msg.length > 1) {
        var args = msg.split(" "),
            command = args.shift().substr(1);
            
        switch (command) {
        case "say":
          if (args.length > 1) {
            var chan = args.shift();
            client.join(chan);
            client.say(chan, args.join(" "));
            client.part(chan);
          }
          break;
        }
      } else {
        say(msg);
      }
    } else {
      client.say(nick, "I don't want to talk to you, fuck off.");
    }
  });
  
  // Start the HTTP Server
  server.start(logs, client);

});

}());