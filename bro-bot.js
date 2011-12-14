/////////////////////////////////////////////////////////////////////////////////////
// Bro-Bot
// By Abjorn <https://github.com/Abjorn>
/////////////////////////////////////////////////////////////////////////////////////
//
// TODO:
//  * ?seen command to see when a user was last seen
//  * ?link / ?addlink / ?remlink commands for adding common links and managing them.
//  * ?yt command to search youtube
//
//////////////////////////////////////////////////////////////////////////////////////
var console      = require("console"),
    url          = require("url"),
    http         = require("http"),
    https        = require("https"),
    irc          = require("irc"),
    sofa         = require("sofa"),
    relativeDate = require("relative-date"),
    config       = require("./config");

// Globals
var VERSION    = "Bro-Bot Version 0.9.5",                 // Version String
    server     = new sofa.Server({ host : "127.0.0.1" }), // CouchDB server
    db         = new sofa.Database(server, "bro-bot"),    // CouchDB Database
    chatCount  = 0,                                       // Messages this second (flood control)
    urlMatch   = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, // Match a URL
    titleMatch = /\<title\>([\w\W]*?)\<\/title\>/i,                                    // Match a HTML Title
    messages, client;

// Retrive messages db doc
db.get("messages", function (doc, err) {
  messages = doc;
  if (err) {
    console.error("[ERROR] Was unable to retrieve document 'messages.'");
    console.error("        " + err);
  }
});

// Create IRC Client
client = new irc.Client("irc.freenode.net", config.nickname, {
  username : config.nickname,
  channels : [config.channel]
});

// Flood control
function clearChatCount() {
  chatCount = 0;
  setTimeout(clearChatCount, 1000);
}
setTimeout(clearChatCount, 1000);

// Send a message to the channel
function say (msg) {
  if (chatCount < 5) {
    console.log("[" + config.nickname + "] " + msg);
    client.say(config.channel, msg);
    chatCount += 1;
  }
}

// Follow a URL to output it's html <title>
function handleURL(u) {
  var urlObject = url.parse(u),
      protocol = (urlObject.protocol === "https:") ? https : http;
  protocol.get(urlObject, function (res) {
    if (res.statusCode === 301 || res.statusCode === 302) {
      handleURL(res.headers.location);
    } else if (res.statusCode === 200 && res.headers["content-type"].split(";")[0] === "text/html") {
      res.on("data", function (chunk) {
        var html = chunk.toString("utf8"),
            title;
        title = titleMatch.exec(html);
        if (title !== null) {
          title = title[1].trim().replace(/[\t\r\n]+/g, " ");
          say(title);
        }
      });
    }
  }).on("error", function (e) {
    console.error("[ERROR] Unable to fetch " + u);
    console.error("        " + e);
  });
}

// Error Listener
client.addListener("error", function (error) {
  console.error(error);
});

// MOTD Listener
// Essentially when the bot connects to freenode
client.addListener("motd", function (motd) {
  console.log("Connected to Freenode");
  if (config.password !== "") {
    client.say("nickserv", "identify " + config.password);
  }
});

// Join Listener
// Called whenever a user (or bro-bot) connect
client.addListener("join" + config.channel, function (nick) {
  if (nick === config.nickname) {
    say(VERSION);
  } else {
    console.log("[" + nick + "] joined.");
  }
});

// Part Listener
// Called whenever a user disconnects from the channel
client.addListener("part" + config.channel, function (nick, reason) {
  console.log("[" + nick + "] Left. (" + reason + ")");
  // In case Bro-Bot gets disconnected
  if (nick === config.nickname) {
    client.join(config.channel);
    if (config.password !== "") {
      client.say("nickserv", "ghost " + config.nickname + " " + config.password);
      client.say(config.channel, "/nick " + config.nickname);
      client.say("nickserv", "identify " + config.password);
    }
  }
});

// Message Listener
// Called whenever someone sends a message in the channel
client.addListener("message" + config.channel, function (nick, msg) {
  console.log('[' + nick + "] " + msg);
  
  // Check for messages left for the user
  if (messages[nick.toLowerCase()] && messages[nick.toLowerCase()].length > 0) {
    var userMessages = messages[nick.toLowerCase()];
    for (var i = 0; i < userMessages.length; i++) {
      say(nick + ": " + userMessages[i].sender + " said \"" + userMessages[i].message + "\" " + relativeDate(userMessages[i].date));
    }
    messages[nick.toLowerCase()] = [];

    db.save(messages, function (res) {
      res.ok || console.error(res.error);
    });
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
      
    // Let Me Google That For You
    case "lmgtfy":
      say(prefix + "http://lmgtfy.com/?q=" + args.join("+"));
      break;
      
    //// Get help on Commands ////
    case "help":
      if (args.length === 0) {
        say(prefix + "Current commands are 'search', 'logs', 'cpp', 'python', 'msdn', 'sdl', 'sfml', 'boost', 'karma', and 'lmgtfy'.");
      } else {
        switch (args[0]) {
        case "search":
          say(prefix + "Format: ?search <terms>");
          say(prefix + "This will search Google through the site vidyadev.org");
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
        say(prefix + "H̕͞͡E̡͘͞͝ ̶C̸͢O҉̢͘͠M̴͢͡͡E̡͟͢T҉̴͘H̸̡̧̛");  
      } else {
        say("H̕͞͡E̡͘͞͝ ̶C̸͢O҉̢͘͠M̴͢͡͡E̡͟͢T҉̴͘H̸̡̧̛");  
      }
      break;
    case "flip":
      if (toAnotherUser) {
        say(prefix + "(╯‵Д′)╯彡┻━┻)ﾟДﾟ)彡☆");
      } else {
        say("(╯‵Д′)╯彡┻━┻)ﾟДﾟ)彡☆");
      }
      break;
    }
  } else {
    // Lookup titles of URLs said in chat
    var matches;
    while ((matches = urlMatch.exec(msg)) !== null) {
      handleURL(matches[0]);
    }

    var tokens = msg.split(" ");
    switch (tokens[0]) {
    case (config.nickname + ":"):
      if (tokens.length > 1 && tokens[1].toLowerCase() === "tell" && tokens.length > 3) {
        // leave messages
        var name = tokens[2].toLowerCase(),
            newMessage = tokens.slice(1).join(" ");
        if (typeof messages[name] === "undefined") {
          messages[name] = [];
        }
        messages[name].push({
          sender : nick,
          message : newMessage,
          date : Date.now()
        });
        db.save(messages, function (res) {
          if (res.ok) {
            say(nick + ": Okay");
          } else {
            console.error(res.error);
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
});

// Handle private messages
client.addListener("pm", function (nick, msg) {
  if (nick.toLowerCase() === config.admin) {
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
    client.say(nick, "I don't want to talk to you, go away.");
  }
});