var Packets = (function () { // Module pattern
  var exports = {};
  
  var VERSION = exports.VERSION = 0x00;
  var PROTOCOL = exports.PROTOCOL = 0xC0BA17*0x100 + VERSION;
  
  var TYPES = exports.TYPES = {
    'region-properties': 1,
    'cell-cache': 2,
    'agent-cache': 3,
    'cell-update': 4,
    'agent-update': 5,
    
    1: 'region-properties',
    2: 'cell-cache',
    3: 'agent-cache',
    4: 'cell-update',
    5: 'agent-update',
  }
  
  var packetDefinitions = exports.packetDefinitions = {};
  
  packetDefinitions['region-properties'] = {
    width      : {type: 'UInt16LE', start:  9},
    height     : {type: 'UInt16LE', start: 11},
    subregionsX: {type: 'UInt16LE', start: 13},
    subregionsY: {type: 'UInt16LE', start: 15},
  }
  
  Object.defineProperty(packetDefinitions['region-properties'], 'baseSize', {value: 17, enumerable: false});
  
  packetDefinitions['cell-cache'] = {
    sx:{          type: 'Int16LE' , start:  9},
    sy:{          type: 'Int16LE' , start: 11},
    width:{       type: 'UInt16LE', start: 13},
    height:{      type: 'UInt16LE', start: 15},
    array:{       type: 'NH_Cell' , start: 17, repeatEvery: 13}
  }
  
  Object.defineProperty(packetDefinitions['cell-cache'], 'baseSize', {value: 17, enumerable: false});
  
  packetDefinitions['agent-cache'] = {
    sx:{type: 'Int16LE' , start:  9},
    sy:{ type: 'Int16LE' , start: 11},
    agentCount:{ type: 'UInt32LE', start: 13},
    array:{ type: 'NH_Agent', start: 17, repeatEvery: 8}
  }
  
  Object.defineProperty(packetDefinitions['agent-cache'], 'baseSize', {value: 17, enumerable: false});
  
  packetDefinitions['cell-update'] = {
    sx:{ type: 'Int16LE' , start:  9},
    sy:{ type: 'Int16LE' , start: 11},
    cellCount:{ type: 'UInt32LE', start: 13},
    array:{ type: 'NH_Cell' , start: 17, repeatEvery: 13}
  }
  
  Object.defineProperty(packetDefinitions['cell-update'], 'baseSize', {value: 17, enumerable: false});
  
  packetDefinitions['agent-update'] = packetDefinitions['agent-cache'];
  
  var Packet = exports.Packet = function Packet() {}
  
  var fromBuffer = exports.fromBuffer = function fromBuffer(buffer) {
    var protocol = buffer.readUInt32BE(0);
    
    if(protocol !== PROTOCOL) {
      throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + protocol.toString(16));
    }
    
    var packet = new Packet();
    
    packet.type = TYPES[buffer.readUInt8(4)];
    packet.regionID = buffer.readUInt32LE(5);
    
    if(packetDefinitions[packet.type] === undefined) {
      throw new Error('Packet type not recognized (type id ' + buffer.readUInt8(4) + ')');
    }
    
    propsFromBuffer(packet, buffer);
    
    return packet;
  }
  
  var propsFromBuffer = exports.propsFromBuffer = function propsFromBuffer(packet, buffer) {
    for(var i in packetDefinitions[packet.type]) {
      var prop = packetDefinitions[packet.type][i];
      
      if(prop.repeatEvery) { // This property is an array that goes to the end of the packet
        packet[i] = [];
        
        for(var j = prop.start; j < buffer.length - prop.repeatEvery + 1; j += prop.repeatEvery) {
          packet[i].push(buffer['read' + prop.type](j));
        }
      } else {
        packet[i] = buffer['read' + prop.type](prop.start);
      }
    }
  }
  
  var toBuffer = exports.toBuffer = function toBuffer(packet) {
    if(packet.type === undefined) {
      throw new Error('Required property .type not defined');
    }
    
    if(packet.regionID === undefined) {
      throw new Error('Required property .regionID not defined');
    }
    
    if(TYPES[packet.type] === undefined) {
      throw new Error('Packet type not recognized (type: ' + packet.type + ')');
    }
    
    var size = packetDefinitions[packet.type].baseSize;
    
    if(packet.array && packetDefinitions[packet.type].array) {
      size += packet.array.length*packetDefinitions[packet.type].array.repeatEvery;
    }
    
    var buffer = new NH_Buffer(size);
    
    // Write preamble
    buffer.writeUInt32BE(PROTOCOL, 0);
    buffer.writeUInt8(TYPES[packet.type], 4);
    buffer.writeUInt32LE(packet.regionID, 5);
    
    propsToBuffer(packet, buffer);
    
    return buffer;
  }
  
  var propsToBuffer = exports.propsToBuffer = function propsToBuffer(packet, buffer) {
    for(var i in packetDefinitions[packet.type]) {
      var v = packetDefinitions[packet.type][i];
      
      if(packet[i] === undefined) {
        throw new Error('Required property .' + i + ' not defined');
      }
      
      if(v.repeatEvery) { // This property is an array that goes to the end of the packet
        packet[i] = [];
        
        packet[i].forEach(function(w, j) {
          buffer['write' + v.type](w, v.start + j*v.repeatEvery);
        });
      } else {
        buffer['write' + v.type](packet[i], v.start);
      }
    }
  }
  
  var amendCellCache = exports.amendCellCache = function amendCellCache(cellCache, cellUpdate) {
    var ccDef = packetDefinitions['cell-cache'];
    var cuDef = packetDefinitions['cell-update'];
    
    var cellCacheHeight = cellCache.readUInt16LE(ccDef.height.start);
    
    for(var i = cuDef.array.start; i < cellUpdate.length; i += cuDef.array.repeatEvery) {
      var x = cellUpdate.readUInt16LE(i);
      var y = cellUpdate.readUInt16LE(i + 2);
      
      cellUpdate.copy(cellCache, ccDef.array.start + ccDef.array.repeatEvery*(y + x*cellCacheHeight), i, i + cuDef.array.repeatEvery);
    }
  }
  
  return exports;
})(); // Module pattern

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = Packets;
}
