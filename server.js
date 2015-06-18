process.title = 'test-server';

var repl    = require('repl');
var fs      = require('fs');
var hapi    = require('hapi');
var ws      = require('ws');
var moment  = require('moment');
var zmq = require('zmq');

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
    var object = JSON.parse(message);
    
    switch(object.req) {
      case 'region':
        connection.send(cache.regionPrefixed);
        break;
      case 'region-agents':
        connection.send(cache.agentsPrefixed);
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

// Link to region //

var cache = {};
cache.agentsPrefix = Buffer([0]);
cache.agentsPrefixed = Buffer(0);
cache.regionPrefix = Buffer([1]);
cache.regionPrefixed = Buffer(0);

var updatePrefix = Buffer([2]);

var simSubscriber = zmq.socket('sub');
simSubscriber.connect('tcp://127.0.0.1:3000');
simSubscriber.subscribe('cell');

console.log('Subscriber connected to port 3000');

simSubscriber.on('message', function(topic, message) {
  wsServer.clients.forEach(function(v) {
    v.send(Buffer.concat([updatePrefix, message]));
  });
});

var agentsCacheRequester = zmq.socket('req');
agentsCacheRequester.connect('tcp://127.0.0.1:3001');

agentsCacheRequester.on('message', function(message) {
  cache.agentsPrefixed = Buffer.concat([cache.agentsPrefix, message]);
});

agentsCacheRequester.send('region-agents');

var regionCacheRequester = zmq.socket('req');
regionCacheRequester.connect('tcp://127.0.0.1:3001');

regionCacheRequester.on('message', function(message) {
  cache.regionPrefixed = Buffer.concat([cache.regionPrefix, message]);
  
  simSubscriber.on('message', function(topic, message) {
    var x = message.readUInt16LE(0);
    var y = message.readUInt16LE(2);
    
    message.copy(cache.regionPrefixed, cache.regionPrefix.length + 13*(y + x*12));
  });
});

regionCacheRequester.send('region');

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
  cli.context.zmq             = zmq;
  
  cli.context.options            = options;
  cli.context.log                = log;
  cli.context.server             = server;
  cli.context.wsServer           = wsServer;
  cli.context.cli                = cli;
  
  cli.context.cache = cache;
}
