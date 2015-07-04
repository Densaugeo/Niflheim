var Packets = (function () { // Module pattern
  var exports = {};
  
  var VERSION = exports.VERSION = 0x00;
  var PROTOCOL = exports.PROTOCOL = 0xC0BA17*0x100 + VERSION;
  
  var TYPES = exports.TYPES = {
    'region-properties': 0x01,
    'cell-cache': 0x02,
    'agent-cache': 0x03,
    'cell-update': 0x04,
    
    0x01: 'region-properties',
    0x02: 'cell-cache',
    0x03: 'agent-cache',
    0x04: 'cell-update',
  }
  
  var Packet = exports.Packet = function Packet(options) {}
  
  var parsers = exports.parsers = {};
  
  parsers['region-properties'] = function(packet, buffer) {
    packet.width = buffer.readUInt16LE(9);
    packet.height = buffer.readUInt16LE(11);
    packet.subregionsX = buffer.readUInt16LE(13);
    packet.subregionsY = buffer.readUInt16LE(15);
  }
  
  parsers['cell-cache'] = function(packet, buffer) {
    packet.sx = buffer.readInt16LE(9);
    packet.sy = buffer.readInt16LE(11);
    packet.width = buffer.readInt16LE(13);
    packet.height = buffer.readInt16LE(15);
    
    if(buffer.length < 13*packet.width*packet.height + 17) {
      throw new Error('Buffer is too short (' + buffer.length + ' bytes) for cell-cache packet of width ' + packets.width + ' and height ' + packets.height);
    }
    
    packet.cells = [];
    
    for(var i = 0, endi = packet.width; i < endi; ++i) {
      packet.cells[i] = [];
      
      for(var j = 0, endj = packet.height; j < endj; ++j) {
        packet.cells[i][j] = Particles.Cell.fromBuffer(buffer, 13*packet.height*i + 13*j + 17);
      }
    }
  }
  
  parsers['cell-update'] = function(packet, buffer) {
    packet.sx = buffer.readInt16LE(9);
    packet.sy = buffer.readInt16LE(11);
    packet.cellCount = buffer.readUInt32LE(13);
    
    if(buffer.length < 13*packet.cellCount + 17) {
      throw new Error('Buffer is too short (' + buffer.length + ' bytes) for cell-update packet with cell count ' + packet.cellCount);
    }
    
    packet.cells = [];
    
    for(var i = 0, endi = packet.cellCount; i < endi; ++i) {
      packet.cells[i] = Particles.Cell.fromBuffer(buffer, 13*i + 17);
    }
  }
  
  parsers['agent-cache'] = function(packet, buffer) {
    packet.sx = buffer.readInt16LE(9);
    packet.sy = buffer.readInt16LE(11);
    packet.agentCount = buffer.readUInt32LE(13);
    
    if(buffer.length < 8*packet.agentCount + 17) {
      throw new Error('Buffer is too short (' + buffer.length + ' bytes) for agent-cache packet with agent count ' + packet.agentCount);
    }
    
    packet.agents = [];
    
    for(var i = 0, endi = packet.agentCount; i < endi; ++i) {
      packet.agents[i] = Particles.Agent.fromBuffer(buffer, 8*i + 17);
    }
  }
  
  var parse = exports.parse = function parse(buffer) {
    var protocol = buffer.readUInt32BE(0);
    
    if(protocol !== PROTOCOL) {
      throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + protocol.toString(16));
    }
    
    var packet = new Packet();
    
    packet.type = TYPES[buffer.readUInt8(4)];
    packet.regionID = buffer.readUInt32LE(5);
    
    if(typeof parsers[packet.type] === 'function') {
      parsers[packet.type](packet, buffer);
    } else {
      throw new Error('Packet type not recognized (type id ' + type + ')');
    }
    
    return packet;
  }
  
  return exports;
})(); // Module pattern

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = Packets;
}
