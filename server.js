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
cache.agents = Buffer(0);
cache.cells = Buffer(0);
cache.regionProperties = Buffer(0);

var simSubscriber = zmq.socket('sub');
simSubscriber.connect('tcp://127.0.0.1:3000');
simSubscriber.subscribe('');

log('Subscriber connected to tcp://127.0.0.1:3000');

simSubscriber.on('message', function(topic, message) {
  wsServer.clients.forEach(function(v) {
    v.send(topic);
  });
});

var agentsCacheRequester = zmq.socket('req');
agentsCacheRequester.connect('tcp://127.0.0.1:3001');

agentsCacheRequester.on('message', function(message) {
  log('Agent cache received (' + message.length + ' bytes)');
  
  cache.agents = message;
});

agentsCacheRequester.send('region-agents');

var regionProperties = {
  width: 0,
  height: 0,
  cellMessageLength: 0,
}

var regionPropertiesRequester = zmq.socket('req');
regionPropertiesRequester.connect('tcp://127.0.0.1:3001');

regionPropertiesRequester.on('message', function(message) {
  regionProperties.width = message.readUInt16LE(9);
  regionProperties.height = message.readUInt16LE(11);
  regionProperties.cellMessageLength = 13;
  regionProperties.received = true;
  
  cache.regionProperties = message;
  
  log('Received region properties: ' + JSON.stringify(regionProperties));
});

regionPropertiesRequester.send('region-properties');

var regionCacheRequester = zmq.socket('req');
regionCacheRequester.connect('tcp://127.0.0.1:3001');

regionCacheRequester.on('message', function(message) {
  log('Region cache received (' + message.length + ' bytes)');
  
  cache.cells = message;
  
  simSubscriber.on('message', function(topic, message) {
    var cellCount = topic.readUInt32LE(13);
    
    for(var i = 0, endi = cellCount; i < endi; ++i) {
      var x = topic.readUInt16LE(13*i + 17);
      var y = topic.readUInt16LE(13*i + 19);
      
      topic.copy(cache.cells, 17 + 13*(y + x*regionProperties.height), 13*i + 17, 13*i + 30);
    }
  });
});

regionCacheRequester.send('region');

log('Cache requests sent to tcp://127.0.0.1:3000');


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
