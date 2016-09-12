process.title = 'nh-hex-relay';

var net = require('net');

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
  
  socket.on('data', function(buffer) {
    console.log(`Received data: ${buffer}`);
  });
  
  socket.on('close', () => console.log(`Connection from ${origin}/ was closed`));
  socket.on('error', e => console.log(`Error in connection from ${origin}/: ${e}`));
});

sim_listener.on('error', e => console.log(`Error in sim listener: ${e}`));
