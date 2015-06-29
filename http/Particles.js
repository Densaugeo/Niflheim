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
    this.color = options.color;
    
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
  
  var Agent = exports.Agent = function Agent(options) {
    // @prop Species species
    this.species = options.species;
    
    this.x = options.x & 0xFFFF;
    
    this.y = options.y & 0xFFFF;
    
    this.agentID = (options.agentID & 0xFFFFFFFF) >>> 0;
  }
  
  Agent.prototype.toBuffer = function toBuffer() {
    var buf = Buffer(8);
    
    buf.writeUInt32LE(this.species.typeID, 0);
    buf.writeUInt32LE(this.agentID, 4);
    
    return buf;
  }
  
  Agent.fromBuffer = function fromBuffer(m, offset) {
    var agent = new Agent({});
    
    agent.species = speciesLibrary[m.readUInt32LE(0 + offset)];
    agent.agentID = m.readUInt32LE(4 + offset);
    
    return agent;
  }
  
  var Cell = exports.Cell = function Cell(options) {
    this.x = options.x;
    
    this.y = options.y;
    
    // @prop Terrain terrain -- Pointer to a Terrain
    this.terrain = options.terrain;
    
    this.hasAgent = Boolean(options.hasAgent);
    
    this.agentID = (options.agentID & 0xFFFFFFFF) >>> 0;
  }
  
  Cell.prototype.toBuffer = function toBuffer() {
    var buf = new Buffer(13);
    
    buf.writeUInt16LE(this.x, 0);
    buf.writeUInt16LE(this.y, 2);
    buf.writeUInt32LE(this.terrain.typeID, 4);
    buf.writeUInt8(Boolean(this.agent), 8);
    buf.writeUInt32LE(this.agent.agentID, 9);
    
    return buf;
  }
  
  Cell.fromBuffer = function fromBuffer(m, offset) {
    var cell = new Cell({});
    
    cell.x = m.readUInt16LE(0 + offset);
    cell.y = m.readUInt16LE(2 + offset);
    cell.terrain = terrainLibrary[m.readUInt32LE(4 + offset)];
    cell.hasAgent = m.readUInt8LE(8 + offset);
    cell.agentID = m.readUInt32LE(9 + offset);
    
    return cell;
  }
  
  var terrainLibrary = exports.terrainLibrary = [
    new Terrain({name: 'grass', char: '.', color: 'rgb(  0, 255,   0)', pauli: false, typeID: 0}),
    new Terrain({name: 'water', char: '~', color: 'rgb(  0,   0, 255)', pauli: true , typeID: 1}),
    new Terrain({name: 'tree' , char: 'T', color: 'rgb(  0, 128,   0)', pauli: false, typeID: 2}),
  ];
  
  var speciesLibrary = exports.speciesLibrary = [
    new Species({name: 'Gremlin'     , char: 'g', color: 'rgb(  0,   0, 255)', pauli: true , typeID: 0}),
    new Species({name: 'Basic Avatar', char: '@', color: 'rgb(255,   0,   0)', pauli: true , typeID: 1}),
  ];
  
  return exports;
})(); // Module pattern

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = Particles;
}
