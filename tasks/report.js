var _ = require('lodash'),
    DataStore = require('../lib/data-store'),
    Fs = require('fs'),
    Gulp = require('gulp'),
    Handlebars = require('handlebars');

var template = Handlebars.compile(Fs.readFileSync(__dirname + '/report.handlebars').toString());

Gulp.task('report', ['report:static'], function() {
  var report = render();
  Fs.writeFileSync('site/index.html', report);
});

Gulp.task('report:static', function() {
  return Gulp.src('static/*')
      .pipe(Gulp.dest('site/'));
});

function render() {
  var data = DataStore.load();

  // Pull out all of the tests that were actually run
  var tests = _.map(data, function(browserData) {
    return _.flatten(_.map(browserData, function(versionData) {
      return _.keys(versionData.stats);
    }));
  });
  tests = _.flatten(tests);
  tests = _.unique(tests);
  tests = tests.sort();

  tests = _.map(tests, function(test) {
    var types = [];

    // Figure out what types this particular test has
    _.each(data, function(browserData) {
      _.each(browserData, function(versionData) {
        var stats = versionData.stats[test] || {};
        types = _.union(types, _.keys(stats.relative), _.keys(stats.errors));
      });
    });
    types = types.sort(function(a, b) {
      if (/^es/.test(a)) {
        a = 'zz' + a;
      }
      if (/^es/.test(b)) {
        b = 'zz' + b;
      }
      return a.localeCompare(b);
    });

    // And then collect the results for each type
    types = _.map(types, function(type) {
      var results = [];
      _.each(data, function(browserData) {
        var firstVersion = true;

        _.each(browserData, function(versionData) {
          var stats = versionData.stats[test] || {},
              speed = (stats.relative || {})[type],
              error = (stats.errors || {})[type];

          var text = '',
              clazz = '';
          if (speed && !error) {
            clazz = speed > 0.9 ? 'test-ok' : 'test-slow';
            text = (speed * 100).toFixed(3) + '%';
          }

          if (firstVersion) {
            clazz += ' browser-first';
            firstVersion = false;
          }

          results.push({
            text: text,
            clazz: clazz
          });

        });
      });

      return {
        name: type,
        results: results
      };
    });

    return {
      name: test,
      types: types
    };
  });

  // And the browsers tested
  var browsers = _.map(data, function(browserData, browserName) {
    return {
      name: browserName,
      versions: _.map(browserData, function(versionData, versionName) {
        if (browserName !== 'node') {
          versionName = parseFloat(versionName);
        }
        return versionName;
      })
    };
  });

  return template({
    browsers: browsers,
    tests: tests
  });
}
