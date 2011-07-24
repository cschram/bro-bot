$(function () {
  "use strict";
  
  $("form#search").submit(function (event) {
    event.preventDefault();
    var input = $(this).find("input").first();
    window.location = "http://bot.vidyadev.org/logs/search/" + input.val().split(" ").join("+");
    return false;
  });
  
});