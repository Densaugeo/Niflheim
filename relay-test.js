process.title = 'nh-hex-relay';

var net = require('net');
var json_string_splitter = require('json-string-splitter');

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
  var origin = `tcp://${socket.address().address}:${socket.address().port}/`;
  console.log(`Received connection from ${origin}`);
  
  var remainder = '';
  
  socket.on('data', function(buffer) {
    var result = json_string_splitter(remainder + buffer.toString('utf8'));
    
    result.jsons.forEach(v => {
      console.log(`Found a json string: ${v}`);
    });
    
    remainder = result.remainder;
  });
  
  socket.on('close', () => console.log(`Connection from ${origin}/ was closed`));
  socket.on('error', e => console.log(`Error in connection from ${origin}/: ${e}`));
});

sim_listener.on('error', e => console.log(`Error in sim listener: ${e}`));
