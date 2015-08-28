process.title = 'test-server';

var repl    = require('repl');
var fs      = require('fs');
var hapi    = require('hapi');
var inert   = require('inert');
var ws      = require('ws');
var moment  = require('moment');
var child_process = require('child_process');

var packets = require(__dirname + '/http/Packets.js');

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

// Logger - Prints to stdout with timestamp, unless silenced by option
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

server.register(inert, function() {});

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
    if(message.constructor.name === 'Buffer') {
      region.stdin.write(message);
      return;
    }
    
    var object = JSON.parse(message);
    
    switch(object.req) {
      case 'region':
        connection.send(cache.cells);
        break;
      case 'region-agents':
        connection.send(cache.agents);
        break;
      case 'region-properties':
        connection.send(cache.regionProperties);
        break;
    }
  });
  
  connection.on('close', function() {
    log('Closed WebSocket');
  });
});

/////////////
// Logging //
/////////////

var eventsToLog = {error: '*'};

if(!options.silent) {
  eventsToLog.log = '*';
  eventsToLog.response = '*';
  
  if(options.logOps) {
    eventsToLog.ops = '*';
  }
}

server.register({
  register: require('good'),
  options: {
    opsInterval: 15000,
    reporters: [{
      reporter: require('good-console'),
      events: eventsToLog
    }]
  }
}, function () {});

// Spawn region
log('Spawning child process for region sim');

var region = child_process.spawn('./target/debug/sim');
region.on('error', function(e) {
  log(e);
  
  throw e;
});

var cellCacheReceived = false;

var streamLeftovers = new Buffer(0);

region.stdout.on('data', function(data) {
  var buffer = Buffer.concat([streamLeftovers, data]);
  var header = {};
  
  while(true) {
    while(true) {
      if(buffer.length < 9) {
        streamLeftovers = buffer;
        return;
      }
      
      try {
        header = packets.getHeader(buffer);
        break;
      } catch(e) {
        buffer = buffer.slice(1);
      }
    }
    
    var packetSize = packets.SIZES[header.type];
    
    if(buffer.length < packetSize) {
      streamLeftovers = buffer;
      return;
    }
    
    var packet = buffer.slice(0, packetSize);
    buffer = buffer.slice(packetSize);
    
    handlePacket(packet);
  }
});

var handlePacket = function(message) {
  var packet = {};
  
  try {
    packet = packets.fromBuffer(message);
  } catch(e) {
    log('Bad packet from region sim');
    return;
  }
  
  switch(packet.type) {
    case packets.TYPES.region_properties:
      regionProperties = packets.fromBuffer(message);
      cache.regionProperties = message;
      log('Received region properties: ' + JSON.stringify(regionProperties));
      break;
    case packets.TYPES.agent_cache:
      cache.agents = message;
      log('Agent cache received (' + message.length + ' bytes)');
      break;
    case packets.TYPES.cell_cache:
      cache.cells = message;
      log('Region cache received (' + message.length + ' bytes)');
      
      cellCacheReceived = true;
      break;
    case packets.TYPES.cell_update:
      wsServer.clients.forEach(function(v) {
        v.send(message);
      });
      
      if(cellCacheReceived) {
        packets.amendCellCache(cache.cells, message);
      }
      break;
  }
}

// Link to region //

var regionProperties = {};

var cache = {};
cache.agents = new Buffer(0);
cache.cells = new Buffer(0);
cache.regionProperties = new Buffer(0);

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
  cli.context.packets             = packets;
  
  cli.context.options            = options;
  cli.context.log                = log;
  cli.context.server             = server;
  cli.context.wsServer           = wsServer;
  cli.context.cli                = cli;
  
  cli.context.cache = cache;
}
