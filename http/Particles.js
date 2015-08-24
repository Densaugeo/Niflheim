/* jshint unused: false */

var ParticleType = exports.ParticleType = function ParticleType(options) {
  // @prop Number typeID -- 32-bit type identifier
  this.typeID = (options.typeID & 0xFFFFFFFF) >>> 0; // jshint ignore:line
  
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

var terrainLibrary = exports.terrainLibrary = [
  new Terrain({name: 'grass', char: '.', color: 'rgb(  0, 255,   0)', pauli: false, typeID: 0}),
  new Terrain({name: 'water', char: '~', color: 'rgb(  0,   0, 255)', pauli: true , typeID: 1}),
  new Terrain({name: 'tree' , char: 'T', color: 'rgb(  0, 128,   0)', pauli: false, typeID: 2}),
];

var speciesLibrary = exports.speciesLibrary = [
  new Species({name: 'Gremlin'     , char: 'g', color: 'rgb(  0,   0, 255)', pauli: true , typeID: 0}),
  new Species({name: 'Basic Avatar', char: '@', color: 'rgb(255,   0,   0)', pauli: true , typeID: 1}),
];
