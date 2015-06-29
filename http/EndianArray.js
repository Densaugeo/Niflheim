/**
 * @description Adds methods for endian-specific reading and writing to Uint8Array.prototype
 */

(function() { // Module pattern, no exports
  /**
   * @module Uint8Array
   */
  
  // @method proto undefined readUInt8(Number offset)
  Uint8Array.prototype.readUInt8 = function readUInt8(offset) {
    return this[offset];
  }
  
  // @method proto undefined readUInt8LE(Number offset) -- Alias for .readUInt8()
  Uint8Array.prototype.readUInt8LE = Uint8Array.prototype.readUInt8;
  
  // @method proto undefined readUInt8BE(Number offset) -- Alias for .readUInt8()
  Uint8Array.prototype.readUInt8BE = Uint8Array.prototype.readUInt8;
  
  // @method proto undefined writeUInt8(Number value, Number offset)
  Uint8Array.prototype.writeUInt8 = function writeUInt8(value, offset) {
    this[offset] = value;
  }
  
  // @method proto undefined writeUInt8LE(Number offset) -- Alias for .writeUInt8()
  Uint8Array.prototype.writeUInt8LE = Uint8Array.prototype.writeUInt8;
  
  // @method proto undefined writeUInt8BE(Number offset) -- Alias for .writeUInt8()
  Uint8Array.prototype.writeUInt8BE = Uint8Array.prototype.writeUInt8;
  
  // @method proto undefined readInt8(Number offset)
  Uint8Array.prototype.readInt8 = function readInt8(offset) {
    var uint = this[offset];
    return (uint << 24) >> 24;
  }
  
  // @method proto undefined readInt8LE(Number offset) -- Alias for .readInt8()
  Uint8Array.prototype.readInt8LE = Uint8Array.prototype.readInt8;
  
  // @method proto undefined readInt8BE(Number offset) -- Alias for .readInt8()
  Uint8Array.prototype.readInt8BE = Uint8Array.prototype.readInt8;
  
  // @method proto undefined writeInt8(Number value, Number offset)
  Uint8Array.prototype.writeInt8 = Uint8Array.prototype.writeUInt8;
  
  // @method proto undefined writeInt8LE(Number offset) -- Alias for .writeInt8()
  Uint8Array.prototype.writeInt8LE = Uint8Array.prototype.writeInt8;
  
  // @method proto undefined writeInt8BE(Number offset) -- Alias for .writeInt8()
  Uint8Array.prototype.writeInt8BE = Uint8Array.prototype.writeInt8;
  
  // @method proto undefined readUInt16LE(Number offset)
  Uint8Array.prototype.readUInt16LE = function readUInt16LE(offset) {
    return this[offset] | (this[offset + 1] << 8);
  }
  
  // @method proto undefined writeUInt16LE(Number value, Number offset)
  Uint8Array.prototype.writeUInt16LE = function writeUInt16LE(value, offset) {
    this[offset    ] = value;
    this[offset + 1] = value >>> 8;
  }
  
  // @method proto undefined readUInt16BE(Number offset)
  Uint8Array.prototype.readUInt16BE = function readUInt16BE(offset) {
    return (this[offset] << 8) | this[offset + 1];
  }
  
  // @method proto undefined writeUInt16BE(Number value, Number offset)
  Uint8Array.prototype.writeUInt16BE = function writeUInt16BE(value, offset) {
    this[offset    ] = value >>> 8;
    this[offset + 1] = value;
  }
  
  // @method proto undefined readInt16LE(Number offset)
  Uint8Array.prototype.readInt16LE = function readInt16LE(offset) {
    var uint = this[offset] | (this[offset + 1] << 8);
    return (uint << 16) >> 16;
  }
  
  // @method proto undefined writeInt16LE(Number value, Number offset)
  Uint8Array.prototype.writeInt16LE = function writeInt16LE(value, offset) {
    this[offset    ] = value;
    this[offset + 1] = value >> 8;
  }
  
  // @method proto undefined readInt16BE(Number offset)
  Uint8Array.prototype.readInt16BE = function readInt16BE(offset) {
    var uint = (this[offset] << 8) | this[offset + 1];
    return (uint << 16) >> 16;
  }
  
  // @method proto undefined writeInt16BE(Number value, Number offset)
  Uint8Array.prototype.writeInt16BE = function writeInt16BE(value, offset) {
    this[offset    ] = value >> 8;
    this[offset + 1] = value;
  }
  
  // @method proto undefined readUInt32LE(Number offset)
  Uint8Array.prototype.readUInt32LE = function readUInt32LE(offset) {
    var int = this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24);
    return int >>> 0;
  }
  
  // @method proto undefined writeUInt32LE(Number value, Number offset)
  Uint8Array.prototype.writeUInt32LE = function writeUInt32LE(value, offset) {
    this[offset    ] = value;
    this[offset + 1] = value >>> 8;
    this[offset + 2] = value >>> 16;
    this[offset + 3] = value >>> 24;
  }
  
  // @method proto undefined readUInt32BE(Number offset)
  Uint8Array.prototype.readUInt32BE = function readUInt32BE(offset) {
    var int = (this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3];
    return int >>> 0;
  }
  
  // @method proto undefined writeUInt32BE(Number value, Number offset)
  Uint8Array.prototype.writeUInt32BE = function writeUInt32BE(value, offset) {
    this[offset    ] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value;
  }
  // @method proto undefined readInt32LE(Number offset)
  Uint8Array.prototype.readInt32LE = function readInt32LE(offset) {
    return this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16) | (this[offset + 3] << 24);
  }
  
  // @method proto undefined writeInt32LE(Number value, Number offset)
  Uint8Array.prototype.writeInt32LE = function writeInt32LE(value, offset) {
    this[offset    ] = value;
    this[offset + 1] = value >> 8;
    this[offset + 2] = value >> 16;
    this[offset + 3] = value >> 24;
  }
  
  // @method proto undefined readInt32BE(Number offset)
  Uint8Array.prototype.readInt32BE = function readInt32BE(offset) {
    return (this[offset] << 24) | (this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3];
  }
  
  // @method proto undefined writeInt32BE(Number value, Number offset)
  Uint8Array.prototype.writeInt32BE = function writeInt32BE(value, offset) {
    this[offset    ] = value >> 24;
    this[offset + 1] = value >> 16;
    this[offset + 2] = value >> 8;
    this[offset + 3] = value;
  }
})(); // Module pattern, no exports
