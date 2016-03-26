var request = require('request');
var argv = require('optimist').argv;
var _ = require('lodash');
var geolib = require('geolib');
var express = require('express');
var fs = require('fs');
var frequently = require('frequently');

var app = express();

var allDocks;

// every 5 minutes to avoid irritating the API gods

frequently(cacheLatestData, 5 * 60000).now();

app.get('/api/find-bike-or-dock', function(req, res) {
  var which = req.query.which;
  var latitude = req.query.latitude;
  var longitude = req.query.longitude;
  return findBikeOrDock(which, latitude, longitude, function(err, results) {
    if (err) {
      return res.send({ status: 'error' });
    }
    return res.send({ status: 'ok', docks: results });
  });
});

app.use(express.static(__dirname + '/public'));

var port = 3000;
try {
  port = parseInt(fs.readFileSync(__dirname + '/data/port'));
} catch (e) {
  console.log('no port file, defaulting to port 3000');
}

return app.listen(port, function(err) {
  if (err) {
    console.error('Oops, port ' + port + ' not available. Are you running another app?');
    process.exit(1);
  } else {
    console.log('Listening on port ' + port + '.');
  }
});

function findBikeOrDock(which, latitude, longitude, callback) {

  if (!allDocks) {
    // We are still booting up and haven't cached any data yet.
    // Try again in 5 seconds
    setTimeout(function() {
      return findBikeOrDock(which, latitude, longitude, callback);
    }, 5000);
    return;
  }

  var docks = _.filter(allDocks, suitable);

  docks.sort(function(a, b) {
    var distanceA = distanceTo(a);
    var distanceB = distanceTo(b);
    if (distanceA < distanceB) {
      return -1;
    } else if (distanceA > distanceB) {
      return 1;
    } else {
      return 0;
    }
  });

  return callback(null, docks);

  function suitable(dock) {
    if (which === 'dock') {
      if (!dock.properties.docksAvailable) {
        return false;
      }
    } else if (which === 'bike') {
      if (!dock.properties.bikesAvailable) {
        return false;
      }
    }
    return true;
  }

  function distanceTo(dock) {
    return geolib.getDistance(geoToLatLong(dock.geometry), { latitude: latitude, longitude: longitude });
  }

}

function geoToLatLong(geo) {
  return {
    latitude: geo.coordinates[1],
    longitude: geo.coordinates[0]
  };
}

function cacheLatestData(callback) {
  return request('https://api.phila.gov/bike-share-stations/v1', function(err, response, body) {
    if (err) {
      console.error('WARNING: API failure', err);
      // try again soon
      return callback();
    }

    if (response.statusCode !== 200) {
      console.error('WARNING: API failure', response.statusCode);
      // try again soon
      return callback();
    }
    allDocks = JSON.parse(body).features;
    return callback();
  });
}
