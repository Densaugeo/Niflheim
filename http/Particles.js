var Particles = (function () { // Module pattern
  var exports = {};
  
  var ParticleType = exports.ParticleType = function ParticleType(options) {
    // @prop Number typeID -- 32-bit type identifier
    this.typeID = (options.typeID & 0xFFFFFFFF) >>> 0;
    
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
  
  var NPC = exports.NPC = function NPC(options) {
    // @prop Species species
    this.species = options.species;
    
    this.cell = options.cell;
    
    this.move = 0;
    
    this.agentID = (options.agentID & 0xFFFFFFFF) >>> 0;
  }
  
  NPC.prototype.toBuffer = function() {
    var buf = Buffer(8);
    
    buf.writeUInt32LE(this.species.typeID, 0);
    buf.writeUInt32LE(this.agentID, 4);
    
    return buf;
  }
  
  var Cell = exports.Cell = function Cell(options) {
    this.x = options.x;
    
    this.y = options.y;
    
    // @prop Terrain terrain -- Pointer to a Terrain
    this.terrain = options.terrain;
    
    this.agent;
  }
  
  // @method proto Boolean pauli() -- True if Cell has at least one Pauli Particle
  Cell.prototype.pauli = function pauli() {
    return this.terrain.pauli;
  }
  
  Cell.prototype.toBuffer = function() {
    var buf = new Buffer(13);
    
    buf.writeUInt16LE(this.x, 0);
    buf.writeUInt16LE(this.y, 2);
    buf.writeUInt32LE(this.terrain.typeID, 4);
    buf.writeUInt8(Boolean(this.agent), 8);
    if(this.agent) {
      buf.writeUInt32LE(this.agent.agentID, 9);
    }
    
    return buf;
  }
  
  var terrainLibrary = exports.terrainLibrary = [
    new Terrain({name: 'grass', char: '.', color: 0x00FF00FF, pauli: false, typeID: 0}),
    new Terrain({name: 'water', char: '~', color: 0x0000FFFF, pauli: true , typeID: 1}),
    new Terrain({name: 'tree' , char: 'T', color: 0x008000FF, pauli: false, typeID: 2}),
  ];
  
  var speciesLibrary = exports.speciesLibrary = [
    new Species({name: 'Gremlin', char: 'g', color: 0x0000FFFF, pauli: true , typeID: 0}),
  ];
  
  return exports;
})(); // Module pattern

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = Particles;
}
