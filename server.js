// server.js
// where your node app starts

// init project
var express = require('express');
var https = require('https');
var app = express();
var _queue = Promise.resolve();
var jsonfile = require('jsonfile');
const STORAGE_FILE = 'storage/q_history.json';

var storagePut = function(searchQuery, date){
  return new Promise( (resolve) => {
    var item = {
      term: searchQuery,
      when: date.toISOString()
    };
    jsonfile.readFile(STORAGE_FILE, (err, storageArr) => {
      if (err) console.log(err);
      if (!storageArr) storageArr = [];
      storageArr.push(item);
      if(storageArr.length > 10) storageArr.shift();
      jsonfile.writeFile(STORAGE_FILE, storageArr, (err) => {
        if (err) console.log(err);
        console.log('here');
        resolve();
      });
    });       
  });
}

var storageGet = function(res){
  return new Promise( (resolve) => {
    jsonfile.readFile(STORAGE_FILE, (err, storageArr) => {
      if (err){
        console.log(err);
        res.end('error');
        resolve();
      } else {
        res.json(storageArr);
        res.end();
        resolve();
      }
    });
  });
}

app.use(express.static('public'));


app.get('/', (req, res) =>{
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/latest', (req, res) => {
  _queue.then( () => {
    storageGet(res);
  });
});


app.get('/search/:search', function (req, res) {
  var date = new Date;
  var q = req.params.search;
  var offset = req.query.offset;
  var start = 1;
  if(offset && offset.length <= 2){
    offset = Number(offset);
    if(Number.isInteger(offset) && offset >= 2 && offset <= 10){
      start = (offset - 1) * 10;
    } else if(offset > 10){
      start = 91;
    }
  }
  console.log(q);
  var options = 'https://www.googleapis.com/customsearch/v1?'
                +'&start=' + start + '&num=10'
                +'&searchType=image'
                +'&q=' + q
                +'&cx=' + process.env.CSE_ID
                +'&key=' + process.env.KEY;
                
  https.get(options, (searchRes) => {
    var scode = searchRes.statusCode;
    if (scode === 200){
      _queue = _queue.then( () => {
        return storagePut(q, date);
      });
      console.log(searchRes.headers);
      searchRes.setEncoding('utf8');
      let rawData = '';
      searchRes.on('data', (chunk) => { rawData += chunk; });
      searchRes.on('end', () => {
        try {
          var items = JSON.parse(rawData).items;
          var result = [];
          items.forEach( (item) => {
            result.push({
              thumbnail: item.image.thumbnailLink,
              context: item.image.contextLink,
              url: item.link,
              snippet: item.snippet
            });
          });
          res.json(result);
          res.end();
        } catch (e) {
          console.error(e.message);
          res.end('error');
        }
      });
    }else{
      console.log(scode);
      res.end('error');
    }
  });
});






// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
