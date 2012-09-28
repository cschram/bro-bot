//////////////////////////////////////////////////////////////////////////////////////
// Bro-Bot
// By Abjorn <https://github.com/Abjorn>
//////////////////////////////////////////////////////////////////////////////////////
//
// TODO:
//  * ?seen command to see when a user was last seen
//
//////////////////////////////////////////////////////////////////////////////////////
var console      = require("console"),
    url          = require("url"),
    http         = require("http"),
    https        = require("https"),
    irc          = require("irc"),
    sofa         = require("sofa"),
    relativeDate = require("relative-date"),
    Sandbox      = require("sandbox"),
    config       = require("./config");

// Globals
var VERSION    = "Bro-Bot Version 1.0.1",                 // Version String
    server     = new sofa.Server({ host : "127.0.0.1" }), // CouchDB server
    db         = new sofa.Database(server, "bro-bot"),    // CouchDB Database
    s          = new Sandbox(),
    chatCount  = 0,                                       // Messages this second (flood control)
    urlMatch   = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, // Match a URL
    titleMatch = /\<title\>([\w\W]*?)\<\/title\>/i,                                    // Match a HTML Title
    users      = {},
    messages, links, client;

// Retrive messages db doc
db.get("messages", function (doc, err) {
    messages = doc;
    if (err) {
        console.error("[ERROR] Was unable to retrieve document 'messages.'");
        console.error("        " + err);
    }
});

// Retrieve links db doc
db.get("links", function (doc, err) {
    links = doc;
    if (err) {
        console.error("[ERROR] Was unable to retrieve document 'links.'");
        console.error("        " + err);
    }
});

// Create IRC Client
client = new irc.Client("irc.freenode.net", config.nickname, {
    username        : config.nickname,
    channels        : [config.channel],
    floodProtection : true
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

// Create HTTP symbol lookup table and replace HTML codes
function makeLegible(t) {
    var trans = {
	"€"  : "&euro;",
	" "  : "&nbsp;",
	"\"" : "&quot;",
	"&"  : "&amp;",
	"<"  : "&lt;",
	">"  : "&gt;",
	"¡"  : "&iexcl;",
	"¢"  : "&cent;",
	"£"  : "&pound;",
	"¤"  : "&curren;",
	"¥"  : "&yen;",
	"¦"  : "&brvbar;",
	"§"  : "&sect;",
	"¨"  : "&uml;",
	"©"  : "&copy;",
	"ª"  : "&ordf;",
	"¬"  : "&not;",
	"­"  : "&shy;",
	"®"  : "&reg;",
	"¯"  : "&macr;",
	"°"  : "&deg;",
	"±"  : "&plusmn;",
	"²"  : "&sup2;",
	"³"  : "&sup3;",
	"´"  : "&acute;",
	"µ"  : "&micro;",
	"¶"  : "&para;",
	"·"  : "&middot;",
	"¸"  : "&cedil;",
	"¹"  : "&sup1;",
	"º"  : "&ordm;",
	"»"  : "&raquo;",
	"¼"  : "&frac14;",
	"½"  : "&frac12;",
	"¾"  : "&frac34;",
	"¿"  : "&iquest;",
	"À"  : "&Agrave;",
	"Á"  : "&Aacute;",
	"Â"  : "&Acirc;",
	"Ã"  : "&Atilde;",
	"Ä"  : "&Auml;",
	"Å"  : "&Aring;",
	"Æ"  : "&AElig;",
	"Ç"  : "&Ccedil;",
	"È"  : "&Egrave;",
	"É"  : "&Eacute;",
	"Ê"  : "&Ecirc;",
	"Ë"  : "&Euml;",
	"Ì"  : "&Igrave;",
	"Í"  : "&Iacute;",
	"Î"  : "&Icirc;",
	"Ï"  : "&Iuml;",
	"Ð"  : "&ETH;",
	"Ñ"  : "&Ntilde;",
	"Ò"  : "&Ograve;",
	"Ó"  : "&Oacute;",
	"Ô"  : "&Ocirc;",
	"Õ"  : "&Otilde;",
	"Ö"  : "&Ouml;",
	"×"  : "&times;",
	"Ø"  : "&Oslash;",
	"Ù"  : "&Ugrave;",
	"Ú"  : "&Uacute;",
	"Û"  : "&Ucirc;",
	"Ü"  : "&Uuml;",
	"Ý"  : "&Yacute;",
	"Þ"  : "&THORN;",
	"ß"  : "&szlig;",
	"à"  : "&agrave;",
	"á"  : "&aacute;",
	"â"  : "&acirc;",
	"ã"  : "&atilde;",
	"ä"  : "&auml;",
	"å"  : "&aring;",
	"æ"  : "&aelig;",
	"ç"  : "&ccedil;",
	"è"  : "&egrave;",
	"é"  : "&eacute;",
	"ê"  : "&ecirc;",
	"ë"  : "&euml;",
	"ì"  : "&igrave;",
	"í"  : "&iacute;",
	"î"  : "&icirc;",
	"ï"  : "&iuml;",
	"ð"  : "&eth;",
	"ñ"  : "&ntilde;",
	"ò"  : "&ograve;",
	"ó"  : "&oacute;",
	"ô"  : "&ocirc;",
	"õ"  : "&otilde;",
	"ö"  : "&ouml;",
	"÷"  : "&divide;",
	"ø"  : "&oslash;",
	"ù"  : "&ugrave;",
	"ú"  : "&uacute;",
	"û"  : "&ucirc;",
	"ü"  : "&uuml;",
	"ý"  : "&yacute;",
	"þ"  : "&thorn;"
    };
    var title = t;
    for (var symb in trans) {
	if (trans.hasOwnProperty(symb)) {
	    title = title.replace(trans[symb], symb);
	}
    }
    return title;
	    
}

// Follow a URL to output it's html <title>
function handleURL(u) {
    var urlObject = url.parse(u),
        protocol = (urlObject.protocol === "https:") ? https : http;

    protocol.get(urlObject, function (res) {
        if (res.statusCode === 301 || res.statusCode === 302) {
            handleURL(res.headers.location);
        } else if (res.statusCode === 200) {
            if (res.headers.hasOwnProperty("content-type") && res.headers["content-type"].split(";")[0] !== "text/html") {
                return;
            }
            res.on("data", function (chunk) {
                var html = chunk.toString("utf8"),
                        title;
                title = titleMatch.exec(html);
                if (title !== null) {
                    title = title[1].trim().replace(/[\t\r\n]+/g, " ");
                    say(makeLegible(title));
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
        say(irc.colors.wrap("dark_red", VERSION));
    } else {
        console.log("[" + nick + "] joined.");
        users[nick] = "";
    }
});

// Names Listener
// Called when a channel sends a list of nicks
client.addListener("names", function (channel, nicks) {
    if (channel === config.channel) {
        users = nicks;
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
    } else {
        users[nick] = undefined;
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
            if (!res.ok) {
                console.error(res.error);
            }
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

        // Leave a message for a user
        case "tell":
            if (args.length > 1) {
                var recp = args.shift();
                if (typeof messages[recp] === "undefined") {
                    messages[recp] = [];
                }
                messages[recp].push({
                    sender : nick,
                    message : args.join(" "),
                    date : Date.now()
                });
                db.save(messages, function (res) {
                    if (res.ok) {
                        say(nick + ": Okay");
                    } else {
                        console.error(res.error);
                    }
                });
            } else {
                say(nick + ": Format: ?tell <user> <message>");
            }
            break;

        // Eval JS Code
        case "js":
        case "eval":
            s.run(args.join(" "), function (output) {
                say(prefix + output.result);
            });
            break;
            
        // Let Me Google That For You
        case "lmgtfy":
            say(prefix + "http://lmgtfy.com/?q=" + args.join("+"));
            break;
            
        //// Get help on Commands ////
        case "help":
            if (args.length === 0) {
                say(prefix + "Current commands are 'tell', 'js', and 'lmgtfy'.");
            } else {
                switch (args[0]) {
                case "tell":
                    say(prefix + "Format: ?tell <user> <message>");
                    say(prefix + "Leaves a message for a user the next time they are active in the channel.");
                    say(prefix + 'Same as "bro-bot: tell <user> <message>"');
                    break;
                case "js":
                    say(prefix + "Format: ?js <expression>");
                    say(prefix + "Evaluates a JavaScript expression and returns the result.");
                    break;
                case "lmgtfy":
                    say(prefix + "Format: ?lmgtfy <terms>");
                    say(prefix + "This will return a Let Me Google That For You search.");
                    break;
                }
            }
            break;
        //// End of Help ////
            
        // Special commands OMG
        case "zalgo":
            if (toAnotherUser) {
                say(prefix + "H̕͞͡E̡͘͞͝ ̶C̸͢O҉̢͘͠M̴͢͡͡E̡͟͢T҉̴͘H̸̡̧̛");
            } else {
                say("H̕͞͡E̡͘͞͝ ̶C̸͢O҉̢͘͠M̴͢͡͡E̡͟͢T҉̴͘H̸̡̧̛");
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
        while ((matches = urlMatch.exec(msg)) !== null && nick !== "AGDGBot") {
            handleURL(matches[0]);
        }

        var tokens = msg.split(" ");
        if (tokens[0] === (config.nickname + ":")) {
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
        } else if (tokens[0] === ">mfw") {
            say("http://myfacewhen.com/" + Math.floor(Math.random() * 427) + "/");
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
