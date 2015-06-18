/**
 * @description Provides DF.Node, an asynchronous non-recursive EventEmitter replacement
 */
var DF = {};

// @method undefined pipe(DF.Node source, String sourcePort, DF.Node destination, String destinationPort) -- Connects DF Nodes. The destination's port function is called and given data from the source's port
DF.pipe = function pipe(source, sourcePort, destination, destinationPort) {
  if(source._DF_pipes[sourcePort] == null) {
    source._DF_pipes[sourcePort] = [];
  }
  
  source._DF_pipes[sourcePort].push(new DF.Pipe({node: destination, port: destinationPort}));
}

// Shim to provide setImmediate() in all browsers
if(typeof setImmediate === 'undefined') {
  setImmediate = function setImmediate(cb) {
    setTimeout(cb, 0);
  }
}

/**
 * @module DF.Pipe
 * @description Represents the destination of a pipe made by DF.pipe() (for internal use)
 */
DF.Pipe = function Pipe(options) {
  // @prop DF.Node node
  // @option DF.Node node -- Set .node property
  this.node = options.node;
  
  // @prop String port
  // @option String port -- Set .port property
  this.port = options.port;
}

/**
 * @module DF.Node
 * @description DF nodes are similar to EventEmitters
 * 
 * @example var node1 = new DF.Node();
 * @example var node2 = new DF.Node();
 * @example 
 * @example node2.onFoo = function(arg) {
 * @example   console.log(arg);
 * @example });
 * @example DF.pipe(node1, 'foo', node2, 'onFoo');
 * @example 
 * @example node.emit('foo', 'bar');
 */
DF.Node = function Node(options) {
  // @prop [DF.Pipe] _DF_pipes -- Array of destinations for DF pipes leading from this node. Not enumerable
  Object.defineProperty(this, '_DF_pipes', {value: {}});
}

// @method proto undefined emit(String port, * data) -- Emit a packet. Passes 'data' argument on to listeners
DF.Node.prototype.emit = function emit(port, data) {
  this._DF_pipes[port] && this._DF_pipes[port].forEach(function(v, i, a) {
    setImmediate(function() {
      v.node[v.port](data);
    });
  });
}

// @method proto undefined emitSync(String port, * data) -- Synchronous version of .emit()
DF.Node.prototype.emitSync = function emitSync(port, data) {
  this._DF_pipes[port] && this._DF_pipes[port].forEach(function(v, i, a) {
    v.node[v.port](data);
  });
}

// @method proto DF.Node on(String port, Function listener) -- Adds a listener. Surprise
DF.Node.prototype.on = function on(port, listener) {
  var a = {};
  a['on' + port] = listener;
  
  DF.pipe(this, port, a, 'on' + port);
  
  return this;
}

// @method proto DF.Node addListener(String port, Function listener) -- Alias for on
DF.Node.prototype.addListener = DF.Node.prototype.on;

// @method proto DF.Node addEventListener(String port, Function listener) -- Alias for on
DF.Node.prototype.addEventListener = DF.Node.prototype.on;

if(typeof module != 'undefined' && module != null && module.exports) {
  module.exports = DF;
}
