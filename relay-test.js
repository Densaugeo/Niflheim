process.title = 'nh-hex-relay';

var net = require('net');
var json_string_splitter = require('json-string-splitter');
var repl = require('repl');
var ws = require('ws');

var cache = {
  map: {
    terrains: [],
    tiles: [],
  },
  tileIndices: [],
}

for(var x = 0; x < 256; ++x) {
  cache.tileIndices[x] = [];
  
  for(var y = 0; y < 256; ++y) {
    cache.tileIndices[x][y] = null;
  }
}

cache.updateTile = function(tile) {
  if(this.tileIndices[tile.x][tile.y] !== null) {
    this.map.tiles[this.tileIndices[tile.x][tile.y]] = tile;
  } else {
    this.tileIndices[tile.x][tile.y] = this.map.tiles.length;
    this.map.tiles.push(tile);
  }
}

//////////////////////////////
// Host Connection From Sim //
//////////////////////////////

var sim_listener = net.createServer();

sim_listener.listen({
  host: '127.0.0.1',
  port: 3556
});

sim_listener.on('listening', function() {
  var url = `tcp://${sim_listener.address().address}:${sim_listener.address().port}/`;
  console.log(`Listening for sim servers on ${url}`);
});


sim_listener.on('connection', function(socket) {
  var origin = `ws://${socket.address().address}:${socket.address().port}/`;
  console.log(`Received connection from ${origin}`);
  
  var remainder = '';
  
  socket.on('data', function(buffer) {
    var result = json_string_splitter(remainder + buffer.toString('utf8'));
    
    result.jsons.forEach(v => {
      try {
        var update = JSON.parse(v);
      }
      catch(err) {
        console.log(`Received bad json from sim at ${origin}`);
        return;
      }
      
      if(update.terrains) {
        update.terrains.forEach((v, i) => cache.map.terrains[i] = v);
      }
      
      if(update.tiles) {
        update.tiles.forEach(v => cache.updateTile(v));
      }
      
      if(update.x !== undefined) {
        cache.updateTile(update);
      }
      
      client_listener.clients.forEach(client => client.send(v));
    });
    
    remainder = result.remainder;
  });
  
  socket.on('close', () => console.log(`Connection from ${origin}/ was closed`));
  socket.on('error', e => console.log(`Error in connection from ${origin}/: ${e}`));
});

sim_listener.on('error', e => console.log(`Error in sim listener: ${e}`));

////////////////////
// Client WS Host //
////////////////////

var client_listener = new ws.Server({host: '0.0.0.0', port: 8000, path: '/'});

client_listener.on('listening', function() {
  var url = `ws://${client_listener.options.host}:${client_listener.options.port}/`;
  console.log(`Listening for clients on ${url}`);
});


client_listener.on('connection', function(socket) {
  console.log(`Received ws connection, sending current cache`);
  
  socket.send(JSON.stringify(cache.map));
  
  socket.on('message', function(message) {
    // Later...
  });
  
  socket.on('close', () => console.log(`Connection from ?? was closed`));
  socket.on('error', e => console.log(`Error in connection from ??: ${e}`));
});

client_listener.on('error', e => console.log(`Error in client listener: ${e}`));

var cli = repl.start({});
cli.context.sim_listener = sim_listener;
cli.context.client_listener = client_listener;
