// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  console.log('hello client world :o');
  
  var $folkTable = $("#folkTable"),
      rowTemplate = $("#rowTemplate").html(),
      
      keyFinder = /\{\{(\w+)\}\}/ig,

      // get the template string with values inserted
      GetFormattedString = function(templateString, valueObject) {
        return templateString.replace(keyFinder, function (subString, group1 /*, offset, inputString*/) {
          return valueObject[group1];
        });
      };
      
  $.get('/folksUpdate', function(folks) {
    var html = "";
    
    folks.forEach(function(folk, i) {
      folk.index = i;
      html += GetFormattedString(rowTemplate, folk);
    });
    
    $folkTable.find("tbody").html(html);
  });

});
