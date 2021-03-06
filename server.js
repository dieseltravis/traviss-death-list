// server.js

// init project
var https = require("https");
var express = require('express');
var app = express();

// this list of people's names, the wikipedia page id, and the page title
// name is cosmetic, pageid & page are for looking up & linking to wikipedia
// get the pageId from here: https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=jsonfm&titles=Martin%20Landau
// (just change the titles parameter at the end to the title of the page)
// Starting line-up is first 20, Bench is last 5
var folks = require(__dirname + "/folks.json");

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function getHome(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

// SVG icons for alive and dead
// Icons made by Freepik http://www.freepik.com from https://www.flaticon.com/ are licensed by CC 3.0 BY http://creativecommons.org/licenses/by/3.0/
const ALIVE_SVG = "https://cdn.glitch.com/e5af0a8e-03de-4488-a0a7-1e35df780a66%2Felectrocardiogram-line.svg?1501914693272";
const DEAD_SVG = "https://cdn.glitch.com/e5af0a8e-03de-4488-a0a7-1e35df780a66%2Ftombstone.svg?1501914693315";

// api end point to return the content and timestamp for a piped list of pageids passed in through {{q}}
const WIKI_QUERY = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=revisions&pageids={{q}}&utf8=1&rvprop=content%7Ctimestamp";
const Q = /\{\{q\}\}/;

// regex matches birth date and a death date if it exists from the wiki markup
const MATCH_AGE = /age\s*(\|[dm]f=ye?s?)?(\|(\d+)\|(\d+)\|(\d+))?\|(\d+)\|(\d+)\|(\d+)(\|[dm]f=ye?s?)?\|?\}/i;
// this enum represents the group locations for each of the values in the above regex
const MATCH_KEYS = {
  BIRTH: {
    YEAR: 6,
    MONTH: 7,
    DAY: 8
  },
  DEATH: {
    YEAR: 3,
    MONTH: 4,
    DAY: 5
  }
};

// returns true if a value isn't null, undefined or NaN
var isOK = function (val) {
  return !(val === null || typeof(val) === "undefined" || isNaN(val));
};

// prefix single digits with a zero
var zeroPad = function (n) {
    return (n < 10) ? ("0" + n) : n;
};

// this calculates an age in integer years based on a start and optionally end date
var getAge = function (by, bm, bd, dy, dm, dd) {
  var zeroMonth = bm - 1,
      endday = (isOK(dy)) ? new Date(dy, dm - 1, dd) : new Date(),
      birthDate = new Date(by, zeroMonth, bd),
      age = endday.getFullYear() - birthDate.getFullYear(),
      m = endday.getMonth() - birthDate.getMonth();
  
  if (m < 0 || (m === 0 && endday.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// this function takes in the array of folks and queries the wikipedia api to parse out the data, 
// after success, it returns the object through the express response
var getWikiData = function (folks, expressResponse) {
  // return all the pageids as a piped list
  var q = folks.map(function mapPageid(f) { return f.pageid; }).join('|');
  var url = WIKI_QUERY.replace(Q, q);
  
  var req = https.get(url, function getWikiJson(res) {
    console.log('STATUS: ' + res.statusCode);

    var output = '';
    res.setEncoding('utf8');

    res.on('data', function onData(chunk) {
      output += chunk;
    });

    res.on('end', function onEnd() {
      var data = JSON.parse(output),
          pages = data.query.pages,
          wikiData = {};
      
      for (var key in pages) {
        if (pages.hasOwnProperty(key)) {
          console.log("pageid: " + key);
        
              // get timestamp and content properties from wiki data
          var timestamp = pages[key].revisions[0].timestamp,
              content = pages[key].revisions[0]["*"],
              // match for birth and death date values
              match = content.match(MATCH_AGE),
              // if there were no matches the values will be null, if any groups aren't matched, they will be NaN
              byear = match === null ? null : parseInt(match[MATCH_KEYS.BIRTH.YEAR], 10),
              bmonth = match === null ? null : parseInt(match[MATCH_KEYS.BIRTH.MONTH], 10),
              bday = match === null ? null : parseInt(match[MATCH_KEYS.BIRTH.DAY], 10),
              birthday = {
                year: byear,
                month: bmonth,
                day: bday
              },
              dyear = match === null ? null : parseInt(match[MATCH_KEYS.DEATH.YEAR], 10),
              dmonth = match === null ? null : parseInt(match[MATCH_KEYS.DEATH.MONTH], 10),
              dday = match === null ? null : parseInt(match[MATCH_KEYS.DEATH.DAY], 10),
              deathday = {
                year: dyear,
                month: dmonth,
                day: dday
              };

          // store parsed data in temporary hash
          wikiData[key + ""] = {
            birthday: birthday,
            deathday: deathday,
            timestamp: timestamp
          };
        } 
      }
      
      // loop through array of folks and update with data stored in hash
      folks.forEach(function eachFolk(folk, index) {
        var id = folk.pageid + "",
            hashDataItem = wikiData[id];
        
        folk.index = index;
        
        folk.birthday = hashDataItem.birthday;
        folk.hasBirth = (isOK(folk.birthday.year));
        folk.birthdayText = (folk.hasBirth) ? folk.birthday.year + "-" + zeroPad(folk.birthday.month) + "-" + zeroPad(folk.birthday.day) : "";
        
        folk.deathday = hashDataItem.deathday;
        folk.hasDeath = (isOK(folk.deathday.year));
        folk.deathdayText = (folk.hasDeath) ? folk.deathday.year + "-" + zeroPad(folk.deathday.month) + "-" + zeroPad(folk.deathday.day) : "";

        folk.age = getAge(folk.birthday.year, folk.birthday.month, folk.birthday.day, folk.deathday.year, folk.deathday.month, folk.deathday.day);
        folk.pointValue = 100 - folk.age;
        folk.actualPoints = (folk.hasDeath) ? folk.pointValue : 0; 

        folk.img = (folk.hasDeath) ? DEAD_SVG : ALIVE_SVG;
        folk.statusText = (folk.hasDeath) ? "dead" : "alive"; 
        
        folk.timestamp = hashDataItem.timestamp;
        folk.updatedDate = new Date(folk.timestamp);
        folk.updatedText = folk.updatedDate.getFullYear() + "-" + zeroPad(folk.updatedDate.getMonth() + 1) + "-" + zeroPad(folk.updatedDate.getDate()); 
      });

      expressResponse.send(folks);
    });
  });

  req.on('error', function onError(err) {
    console.error(err);
  });

  req.end();
};

// for debugging, return initial js array of folks
app.get("/folks", function getFolks(request, response) {
  response.send(folks);
});

// return array of folks that has been updated with wikipedia data
app.get("/folksUpdate", function getFolks(request, response) {
  getWikiData(folks, response);
});

// this is a test response for someone who is definitely dead
app.get("/test", function getTest(request, response) {
  //https://en.wikipedia.org/w/api.php?action=query&titles=Martin_Landau&prop=revisions&rvprop=content&format=jsonfm
  getWikiData([{ name: "Martin Landau", "pageid": 261053, page: "Martin_Landau" }], response);
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function appListen() {
  console.log('Your app is listening on port ' + listener.address().port);
});