process.title = 'test-server';

var repl    = require('repl');
var fs      = require('fs');
var hapi    = require('hapi');
var ws      = require('ws');
var moment  = require('moment');

//////////////
// Settings //
//////////////

var options;

try {
  options = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
} catch(e) {
  console.log('Warning: Unable to read config file "' + __dirname + '/config.json". (' + e + ')');
  console.log('Attempting to use "' + __dirname + '/default_config.json"...');
  
  try {
    options = JSON.parse(fs.readFileSync(__dirname + '/default_config.json'));
  } catch(f) {
    console.log('Error: Unable to read config file "' + __dirname + '/default-config.json". (' + f + ')');
    process.exit(1);
  }
}

// Logger - Prints to stdout with timestamp, unless silenced by option. Add log file support?
var log = options.silent ? function(){} : function(message){'use strict';console.log(moment.utc(Date.now()).format('YYMMDD/HHmmss.SSS') + ', ' + message)};

/////////////////
// HTTP Server //
/////////////////

var server = new hapi.Server();

server.connection({
  host: options.host,
  port: options.port,
  tls: options.tls ? {
    key: fs.readFileSync(__dirname + '/' + options.key),
    cert: fs.readFileSync(__dirname + '/' + options.cert)
  } : false
});

server.route({
  method: 'GET',
  path: '/{param*}',
  handler: {
    directory: {
      path: __dirname + '/http',
      index: true
    }
  }
});

server.start(function () {
  'use strict';
  
  log('Server running at: ' + server.info.uri);
});

///////////////
// WS server //
///////////////

var wsServer = new ws.Server({server: server.listener, path: '/'});

wsServer.on('connection', function(connection) {
  'use strict';
  
  log('Received WebSocket');
  
  connection.on('message', function(message) {
    log('Received message: ' + message);
  });
  
  connection.on('close', function() {
    log('Closed WebSocket');
  });
});

/////////////
// Logging //
/////////////

server.register({
  register: require('good'),
  options: {
    opsInterval: 15000,
    reporters: [{
      reporter: require('good-console'),
      events: options.silent ? {error: '*'} : {error: '*', log: '*', response: '*', ops: '*'}
    }]
  }
}, function () {});

////////////////////////////
// World contruction area //
////////////////////////////

var Region = function Region(options) {
  'use strict';
  // @prop Number width -- Width of Region in Cells (1 to 1024)
  this.width  = Math.min(Math.max(Number(options.width ) || 0, 1), 1024);
  
  // @prop Number height -- Height of Region in Cells (1 to 1024)
  this.height = Math.min(Math.max(Number(options.height) || 0, 1), 1024);
  
  for(var i = 0, endi = this.width; i < endi; ++i) {
    this[i] = new Array(this.height);
    
    for(var j = 0, endj = this.heigth; j < endj; ++j) {
      this[i][j] = {};
    }
  }
}
Region.prototype = Object.create(Array.prototype);
Region.prototype.constructor = Region;

var aRegion = new Region({width: 12, height: 12});

var Cell = function Cell(options) {
  'use strict';
  // @prop ? terrain
  this.terrain = 'some terrain';
}

var Terrain = function Terrain(options) {
  'use strict';
  // @prop String char -- Char for roguellike display
  this.char = String(options.char || ' ')[0];
  
  // this.
}

//////////
// REPL //
//////////

if(options.repl) {
  var cli = repl.start({});
  
  cli.context.repl               = repl;
  cli.context.fs                 = fs;
  cli.context.hapi               = hapi;
  cli.context.ws                 = ws;
  cli.context.moment             = moment;
  
  cli.context.options            = options;
  cli.context.log                = log;
  cli.context.server             = server;
  cli.context.wsServer           = wsServer;
  cli.context.cli                = cli;
  
  // World construction stuff
  cli.context.Region  = Region;
  cli.context.aRegion = aRegion;
}
