#!/bin/bash
npm install irc
npm install sofa
npm install relative-date
wget http://packages.couchbase.com/releases/couch/1.2.0/couchbase-server-community_x86_1.2.0.deb
dpkg -i couchbase-server-community_x86_1.2.0.deb
curl -X PUT http://127.0.0.1:5984/bro-bot
curl -X PUT http://127.0.0.1:5984/bro-bot/messages -d '{}'