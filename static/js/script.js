$(function () {
  "use strict";
  
  $("form#search input").submit(function (event) {
    window.location = "http://bot.vidyadev.com/logs/search/" + input.val().split(" ").join("+");
    return false;
  });
  
});