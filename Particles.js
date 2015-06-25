var Particles = (function () { // Module pattern
  var exports = {};
  
  var ParticleType = exports.ParticleType = function ParticleType(options) {
    // @prop Number index -- 32-bit registry index
    this.index = (options.index & 0xFFFFFFFF) >>> 0;
    
    // @prop String name -- Common name
    this.name = String(options.name);
    
    // @prop String char -- Char for roguelike display
    this.char = String(options.char || ' ')[0];
    
    // @prop Number color -- 32-bit color, R-G-B-A from most to least significant
    this.color = (options.color & 0xFFFFFFFF) >>> 0;
    
    // @prop Boolean pauli -- No more than one Pauli particle per Cell
    this.pauli = Boolean(options.pauli);
  }
  
  var Terrain = exports.Terrain = function Terrain(options) {
    ParticleType.call(this, options);
  }
  Terrain.prototype = Object.create(ParticleType.prototype);
  Terrain.prototype.constructor = Terrain;
  
  var Species = exports.Species = function Species(options) {
    ParticleType.call(this, options);
  }
  Species.prototype = Object.create(ParticleType.prototype);
  Species.prototype.constructor = Species;
  
  var terrainRegistry = exports.terrainRegistry = [
    new Terrain({name: 'grass', char: '.', color: 0x00FF00FF, pauli: false, index: 0}),
    new Terrain({name: 'water', char: '~', color: 0x0000FFFF, pauli: true , index: 1}),
    new Terrain({name: 'tree' , char: 'T', color: 0x008000FF, pauli: false, index: 2}),
  ];
  
  var speciesRegistry = exports.speciesRegistry = [
    new Species({name: 'Gremlin', char: 'g', color: 0x0000FFFF, pauli: true , index: 0}),
  ];
  
  var NPC = exports.NPC = function NPC(options) {
    // @prop Species species
    this.speciesIndex = options.speciesIndex;
    
    this.x = options.x;
    this.y = options.y;
    
    this.spawned = false;
    
    //this.cell = options.cell;
    
    this.move = 0;
    
    this.agentIndex = (options.agentIndex & 0xFFFFFFFF) >>> 0;
  }
  
  NPC.prototype.toBuffer = function() {
    var buf = Buffer(8);
    
    buf.writeUInt32LE(this.species.index, 0);
    buf.writeUInt32LE(this.agentID, 4);
    
    return buf;
  }
  
  var Cell = exports.Cell = function Cell(options) {
    this.x = options.x;
    
    this.y = options.y;
    
    // @prop Terrain terrain -- Pointer to a Terrain
    this.terrainIndex = options.terrainIndex;
    
    this.hasAgent = options.hasAgent;
    
    this.agentIndex = options.agentIndex;
  }
  
  // @method proto Boolean pauli() -- True if Cell has at least one Pauli Particle
  Cell.prototype.pauli = function pauli() {
    return terrainRegistry[this.terrainIndex].pauli;
  }
  
  Cell.prototype.toBuffer = function() {
    var buf = new Buffer(13);
    
    buf.writeUInt16LE(this.x, 0);
    buf.writeUInt16LE(this.y, 2);
    buf.writeUInt32LE(this.terrain.index, 4);
    buf.writeUInt8(Boolean(this.agent), 8);
    if(this.agent) {
      buf.writeUInt32LE(this.agent.agentID, 9);
    }
    
    return buf;
  }
  
  return exports;
})(); // Module pattern

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = Particles;
}
