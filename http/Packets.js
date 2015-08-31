/* jshint unused: false */

var struct_fu = require('struct-fu');
var buffer = require('buffer');

var VERSION = exports.VERSION = 0x01;
var PROTOCOL = exports.PROTOCOL =  0x1000000*VERSION + 0x17BAC0;

var TYPES = exports.TYPES = {
  REGION_PROPERTIES: 1,
  CELL_CACHE: 2,
  AGENT_CACHE: 3,
  CELL_UPDATE: 4,
  AGENT_UPDATE: 5,
  AGENT_ACTION: 6,
  
  1: 'REGION_PROPERTIES',
  2: 'CELL_CACHE',
  3: 'AGENT_CACHE',
  4: 'CELL_UPDATE',
  5: 'AGENT_UPDATE',
  6: 'AGENT_ACTION',
}

var agentDefinition = exports.agentDefinition = struct_fu.struct([
  struct_fu.uint32le('speciesID'),
  struct_fu.uint32le('agentID')
]);

var cellDefinition = exports.cellDefinition = struct_fu.struct([
  struct_fu.uint16le('x'),
  struct_fu.uint16le('y'),
  struct_fu.uint32le('terrainID'),
  struct_fu.uint8('hasAgent'),
  struct_fu.uint32le('agentID')
]);

var headerDefinition = exports.headerDefinition = struct_fu.struct([
  struct_fu.uint32le('protocol'),
  struct_fu.uint8('type'),
  struct_fu.uint16le('size'),
  struct_fu.uint32le('regionID')
]);

var packetDefinitions = exports.packetDefinitions = {};

packetDefinitions.REGION_PROPERTIES = {
  base: struct_fu.struct([
    struct_fu.uint16le('sx'),
    struct_fu.uint16le('sy'),
    struct_fu.uint8('width'),
    struct_fu.uint8('height')
  ])
}

packetDefinitions.CELL_CACHE = {
  base: struct_fu.struct([
    struct_fu.uint16le('sx'),
    struct_fu.uint16le('sy'),
    struct_fu.uint8('width'),
    struct_fu.uint8('height')
  ]),
  array: cellDefinition
}

packetDefinitions.AGENT_CACHE = {
  base: struct_fu.struct([
    struct_fu.uint16le('sx'),
    struct_fu.uint16le('sy'),
    struct_fu.uint16le('agentCount'),
  ]),
  array: agentDefinition
}

packetDefinitions.CELL_UPDATE = {
  base: struct_fu.struct([
    struct_fu.uint16le('sx'),
    struct_fu.uint16le('sy'),
    struct_fu.uint16le('cellCount')
  ]),
  array: cellDefinition
}

packetDefinitions.AGENT_UPDATE = packetDefinitions.AGENT_CACHE;

packetDefinitions.AGENT_ACTION = {
  base: struct_fu.struct([
    struct_fu.uint32le('agentID'),
    struct_fu.uint8('action'),
    struct_fu.uint8('direction')
  ])
}

var getHeader = exports.getHeader = function getHeader(buffer) {
  var packet = headerDefinition.unpack(buffer);
  
  if(packet.protocol !== PROTOCOL) {
    throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + packet.protocol.toString(16));
  }
  
  return packet;
}

var fromBuffer = exports.fromBuffer = function fromBuffer(buffer) {
  var packet = headerDefinition.unpack(buffer);
  
  if(packet.protocol !== PROTOCOL) {
    throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + packet.protocol.toString(16));
  }
  
  if(TYPES[packet.type]) {
    var type = packetDefinitions[TYPES[packet.type]];
    
    var base = type.base.unpack(buffer, {bytes: headerDefinition.size, bits: 0});
    
    for(var i in base) {
      packet[i] = base[i];
    }
    
    if(type.array) {
      packet.array = [];
      
      for(var offset = headerDefinition.size + type.base.size; offset <= buffer.length - type.array.size; offset += type.array.size) {
        packet.array.push(type.array.unpack(buffer, {bytes: offset, bits: 0}));
      }
    }
  } else {
    throw new Error('Packet type not recognized (type id ' + buffer.readUInt8(4) + ')');
  }
  
  return packet;
}

// TODO pack arrays
var toBuffer = exports.toBuffer = function toBuffer(packet) {
  packet.protocol = PROTOCOL;
  
  var header = headerDefinition.pack(packet);
  var base = packetDefinitions.AGENT_ACTION.base.pack(packet);
  
  return buffer.Buffer.concat([header, base]);
}

var amendCellCache = exports.amendCellCache = function amendCellCache(cellCache, cellUpdate) {
  var ccDef = packetDefinitions.CELL_CACHE;
  var cuDef = packetDefinitions.CELL_UPDATE;
  
  var cacheHeader = headerDefinition.unpack(cellCache);
  var cacheBase = ccDef.base.unpack(cellCache, {bytes: headerDefinition.size, bits: 0});
  
  var updateHeader = headerDefinition.unpack(cellUpdate);
  var updateBase = cuDef.base.unpack(cellUpdate, {bytes: headerDefinition.size, bits: 0});
  
  if(cacheHeader.protocol !== PROTOCOL) {
    throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + cacheHeader.protocol.toString(16));
  }
  
  if(updateHeader.protocol !== PROTOCOL) {
    throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + updateHeader.protocol.toString(16));
  }
  
  if(cacheHeader.type !== TYPES.CELL_CACHE) {
    throw new Error('Expected CELL_CACHE packet (type ' + TYPES.CELL_CACHE + ') but found type ' + cacheHeader.type);
  }
  
  if(updateHeader.type !== TYPES.CELL_UPDATE) {
    throw new Error('Expected CELL_UPDATE packet (type ' + TYPES.CELL_UPDATE + ') but found type ' + updateHeader.type);
  }
  
  if(cacheHeader.regionID !== updateHeader.regionID) {
    throw new Error('CELL_CACHE is for region ' + cacheHeader.regionID + ' but CELL_UPDATE is for region ' + updateHeader.regionID);
  }
  
  if(cacheBase.sx !== updateBase.sx) {
    throw new Error('CELL_CACHE is for sx ' + cacheBase.sx + ' but CELL_UPDATE is for sx ' + updateBase.sy);
  }
  
  if(cacheBase.sy !== updateBase.sy) {
    throw new Error('CELL_CACHE is for sy ' + cacheBase.sx + ' but CELL_UPDATE is for sy ' + updateBase.sy);
  }
  
  var cellCacheHeight = cacheBase.height;
  
  for(var offset = headerDefinition.size + cuDef.base.size; offset <= cellUpdate.length - cuDef.array.size; offset += cuDef.array.size) {
    var cell = cuDef.array.unpack(cellUpdate, {bytes: offset, bits: 0});
    
    var x = cell.x;
    var y = cell.y;
    
    cellUpdate.copy(cellCache, headerDefinition.size + ccDef.base.size + ccDef.array.size*(y + x*cellCacheHeight), offset, offset + cuDef.array.size);
  }
}
