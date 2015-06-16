var request = require('request');
var argv = require('optimist').argv;
var _ = require('lodash');
var geolib = require('geolib');
var app = require('express')();

// app.get('/api/find-bike-or-dock', function(req, res) {

// });

// app.listen(3000);

var which = argv._[0];
var latitude = argv.latitude;
var longitude = argv.longitude;

return findBikeOrDock(which, latitude, longitude, function(err, docks) {
  if (err) {
    console.error('An error occurred.');
    console.error(err);
    process.exit(1);
  }
  if (!docks.length) {
    console.log('Unfortunately, nothing is available.');
  } else {
    console.log(_.pluck(docks, 'properties.addressStreet'));
  }
});

function findBikeOrDock(which, latitude, longitude, callback) {
  return request('https://api.phila.gov/bike-share-stations/v1', function(err, response, body) {

    if (err) {
      return callback(err);
    }

    if (response.statusCode !== 200) {
      return callback(new Error(response.statusCode));
    }

    var docks = JSON.parse(body).features;

    docks = _.filter(docks, suitable);

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
  });

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
