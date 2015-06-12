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
var log = options.silent ? function(){} : function(message){console.log(moment.utc(Date.now()).format('YYMMDD/HHmmss.SSS') + ', ' + message)};

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
  log('Server running at: ' + server.info.uri);
});

///////////////
// WS server //
///////////////

var wsServer = new ws.Server({server: server.listener, path: '/'});

wsServer.on('connection', function(connection) {
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
      events: options.silent ? {error: '*'} : {error: '*', log: '*', response: '*'/*, ops: '*'*/}
    }]
  }
}, function () {});

////////////////////////////
// World contruction area //
////////////////////////////

var Particle = function Particle(options) {
  // @prop String name -- Common name
  this.name = String(options.name);
  
  // @prop String char -- Char for roguellike display
  this.char = String(options.char || ' ')[0];
  
  // @prop Number color -- 32-bit color, R-G-B-A from most to least significant
  this.color = (options.color & 0xFFFFFFFF) >>> 0;
  
  // @prop Boolean pauli -- No more than one Pauli particle per Cell
  this.pauli = Boolean(options.pauli);
}

var Terrain = function Terrain(options) {
  Particle.call(this, options);
  
  // @prop Number type -- 32-bit type identifier
  this.type = (options.type & 0xFFFFFFFF) >>> 0;
}
Terrain.prototype = Object.create(Particle.prototype);
Terrain.prototype.constructor = Terrain;

var terrainLibrary = [
  new Terrain({name: 'grass', char: '.', color: 0x00FF00FF, pauli: false, type: 0}),
  new Terrain({name: 'water', char: '~', color: 0x0000FFFF, pauli: true , type: 1}),
  new Terrain({name: 'tree' , char: 'T', color: 0x008000FF, pauli: false, type: 2}),
];

var Agent = function Agent(options) {
  Particle.call(this, options);
  
  // @prop Number type -- 32-bit type identifier
  this.type = (options.type & 0xFFFFFFFF) >>> 0;
  
  
}
Agent.prototype = Object.create(Particle.prototype);
Agent.prototype.constructor = Agent;

var terrainLibrary = [
  new Agent({name: 'Gremlin', char: 'g', color: 0x0000FFFF, pauli: true , type: 0}),
];

var Cell = function Cell(options) {
  // @prop Terrain terrain -- Pointer to a Terrain
  this.terrain = options.terrain;
}

// @method proto Boolean pauli() -- True if Cell has at least one Pauli Particle
Cell.prototype.pauli = function pauli() {
  return this.terrain.pauli;
}

var Region = function Region(options) {
  // @prop Number width -- Width of Region in Cells (1 to 1024)
  this.width  = Math.min(Math.max(Number(options.width ) || 0, 1), 1024);
  
  // @prop Number height -- Height of Region in Cells (1 to 1024)
  this.height = Math.min(Math.max(Number(options.height) || 0, 1), 1024);
  
  for(var i = 0, endi = this.width; i < endi; ++i) {
    this[i] = new Array(this.height);
    
    for(var j = 0, endj = this.height; j < endj; ++j) {
      this[i][j] = new Cell({terrain: terrainLibrary[0]});
    }
  }
}
Region.prototype = Object.create(Array.prototype);
Region.prototype.constructor = Region;

var aRegion = new Region({width: 12, height: 12});

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
  cli.context.Particle  = Particle;
  cli.context.Terrain  = Terrain;
  cli.context.Cell  = Cell;
  cli.context.Region  = Region;
  cli.context.aRegion = aRegion;
  cli.context.terrainLibrary = terrainLibrary;
}
