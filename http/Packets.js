var Packets = (function () { // Module pattern
  var exports = {};
  
  var VERSION = exports.VERSION = 0x00;
  var PROTOCOL = exports.PROTOCOL =  0x1000000*VERSION + 0x17BAC0;
  
  var TYPES = exports.TYPES = {
    region_properties: 1,
    cell_cache: 2,
    agent_cache: 3,
    cell_update: 4,
    agent_update: 5,
    agent_action: 6,
    
    1: 'region_properties',
    2: 'cell_cache',
    3: 'agent_cache',
    4: 'cell_update',
    5: 'agent_update',
    6: 'agent_action',
  }
  
  var headerDefinition = exports.headerDefinition = struct_fu.struct([
    struct_fu.uint32le('protocol'),
    struct_fu.uint8('type'),
    struct_fu.uint32le('regionID')
  ]);
  
  var packetDefinitions = exports.packetDefinitions = {};
  
  packetDefinitions.region_properties = {
    base: struct_fu.struct([
      struct_fu.uint16le('width'),
      struct_fu.uint16le('height'),
      struct_fu.uint16le('subregionsX'),
      struct_fu.uint16le('subregionsY')
    ])
  }
  
  packetDefinitions.cell_cache = {
    base: struct_fu.struct([
      struct_fu.int16le('sx'),
      struct_fu.int16le('sy'),
      struct_fu.uint16le('width'),
      struct_fu.uint16le('height')
    ]),
    array: Particles.Cell
  }
  
  packetDefinitions.agent_cache = {
    base: struct_fu.struct([
      struct_fu.int16le('sx'),
      struct_fu.int16le('sy'),
      struct_fu.uint32le('agentCount'),
    ]),
    array: Particles.Agent
  }
  
  packetDefinitions.cell_update = {
    base: struct_fu.struct([
      struct_fu.int16le('sx'),
      struct_fu.int16le('sy'),
      struct_fu.uint32le('cellCount')
    ]),
    array: Particles.Cell
  }
  
  packetDefinitions.agent_update = packetDefinitions.agent_cache;
  
  packetDefinitions.agent_action = {
    base: struct_fu.struct([
      struct_fu.uint32le('agentID'),
      struct_fu.uint8('action'),
      struct_fu.uint8('direction')
    ])
  }
  
  var Packet = exports.Packet = function Packet() {}
  
  var fromBuffer = exports.fromBuffer = function fromBuffer(buffer) {
    var packet = headerDefinition.unpack(buffer);
    
    if(packet.protocol !== PROTOCOL) {
      throw new Error('Expected protocol ' + PROTOCOL.toString(16) + ' but found ' + protocol.toString(16));
    }
    
    if(TYPES[packet.type]) {
      var type = packetDefinitions[TYPES[packet.type]];
      
      var base = type.base.unpack(buffer, {bytes: headerDefinition.size, bits: 0});
      
      for(var i in base) {
        packet[i] = base[i];
      }
      
      if(type.array) {
        packet.array = [];
        
        for(var offset = headerDefinition.size + type.base.size; offset < buffer.length; offset += type.array.size) {
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
    var base = packetDefinitions.agent_action.base.pack(packet);
    
    return buffer.Buffer.concat([header, base]);
  }
  
  var amendCellCache = exports.amendCellCache = function amendCellCache(cellCache, cellUpdate) {
    var ccDef = packetDefinitions.cell_cache;
    var cuDef = packetDefinitions.cell_update;
    
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
    
    if(cacheHeader.type !== TYPES.cell_cache) {
      throw new Error('Expected cell_cache packet (type ' + TYPES.cell_cache + ') but found type ' + cacheHeader.type);
    }
    
    if(updateHeader.type !== TYPES.cell_update) {
      throw new Error('Expected cell_update packet (type ' + TYPES.cell_update + ') but found type ' + updateHeader.type);
    }
    
    if(cacheHeader.regionID !== updateHeader.regionID) {
      throw new Error('cell_cache is for region ' + cacheHeader.regionID + ' but cell_update is for region ' + updateHeader.regionID);
    }
    
    if(cacheBase.sx !== updateBase.sx) {
      throw new Error('cell_cache is for sx ' + cacheBase.sx + ' but cell_update is for sx ' + updateBase.sy);
    }
    
    if(cacheBase.sy !== updateBase.sy) {
      throw new Error('cell_cache is for sy ' + cacheBase.sx + ' but cell_update is for sy ' + updateBase.sy);
    }
    
    var cellCacheHeight = cacheBase.height;
    
    for(var offset = headerDefinition.size + cuDef.base.size; offset < cellUpdate.length; offset += cuDef.array.size) {
      var cell = cuDef.array.unpack(cellUpdate, {bytes: offset, bits: 0});
      
      var x = cell.x;
      var y = cell.y;
      
      cellUpdate.copy(cellCache, headerDefinition.size + ccDef.base.size + ccDef.array.size*(y + x*cellCacheHeight), offset, offset + cuDef.array.size);
    }
  }
  
  return exports;
})(); // Module pattern

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = Packets;
}
