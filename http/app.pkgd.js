(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var PersistentWS = window.PersistentWS = require('./bower_components/persistent-ws/');
var buffer = window.buffer = require('./bower_components/buffer/');
var hermes = window.hermes = require('./bower_components/hermes/');

///////////////
// Utilities //
///////////////

// Daisy-chainable HTMLElement maker
var fE = window.fE = PanelUI.forgeElement;

// Shim for vendor-prefixed fullscreen API
if(HTMLElement.prototype.requestFullscreen == undefined) {
  HTMLElement.prototype.requestFullscreen = HTMLElement.prototype.msRequestFullscreen || HTMLElement.prototype.mozRequestFullScreen || HTMLElement.prototype.webkitRequestFullscreen;
}
if(document.exitFullscreen == undefined) {
  document.exitFullscreen = document.msExitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen;
}
if(document.fullscreenElement === undefined) {
  Object.defineProperty(document, 'fullscreenElement', {
    get: function() {
      return document.msFullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
    },
  });
}

///////////////
// Instances //
///////////////

var canvas = window.canvas = fE('canvas', {width: 8*32 + 4, height: 12*32 + 4});
var ctx = window.ctx = canvas.getContext('2d');
ctx.fillStyle = '#C0C0C0';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#000000';
ctx.fillRect(1, 1, canvas.width - 2, canvas.height - 2);

var sidebar = window.sidebar = new PanelUI.Sidebar();
sidebar.addButton({buttonName: 'land'    , faClass: 'fa-university', title: 'Landing page'       });
sidebar.addButton({buttonName: 'help'    , faClass: 'fa-question'  , title: 'Help'               });
sidebar.addButton({buttonName: 'fs'      , faClass: 'fa-arrows-alt', title: 'Fullscreen'         });
sidebar.addButton({buttonName: 'contrast', faClass: 'fa-adjust'    , title: 'Flip Contrast'      });
sidebar.addButton({buttonName: 'clear'   , faClass: 'fa-recycle'   , title: 'Clear local storage'});

var viewPanel = window.viewPanel = new PanelUI.Panel({id: 'viewer', heading: 'First look into Nifleim\'s world'});
viewPanel.domElement.appendChild(canvas);
viewPanel.open();

var helpPanel = window.helpPanel = new PanelUI.Panel({id: 'help', heading: 'A Panel That Could Be Helpful'});
helpPanel.domElement.appendChild(fE('div', {textContent: 'But this is only a demo'}));

var darkColors = window.darkColors = document.getElementById('dark_colors');

////////////
// Events //
////////////

sidebar.on('land', function(e) {
  window.location = '/';
});

sidebar.on('help', function(e) {
  helpPanel.toggleOpen(true);
});

sidebar.on('fs', function(e) {
  if(document.fullscreenElement == null) {
    document.body.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

sidebar.on('contrast', function(e) {
  if(darkColors.parentNode === document.head) {
    document.head.removeChild(darkColors);
    localStorage.contrast = 'light';
  } else {
    document.head.appendChild(darkColors);
    localStorage.contrast = 'dark';
  }
});

sidebar.on('clear', function(e) {
  localStorage.clear();
});

document.addEventListener('keydown', function(e) {
  var direction = [101, 105, 102, 99, 98, 97, 100, 103, 104].indexOf(e.keyCode);
  
  if(direction !== -1) {
    wstest.socket.send(Packets.toBuffer({type: 'agent-action', regionID: 0, agentID: 1, action: 1, direction: direction}));
  }
});

////////////////////
// Initialization //
////////////////////

if(localStorage.contrast === 'light') {
  document.head.removeChild(darkColors);
}

///////////////
// WebSocket //
///////////////

var cache = window.cache = {};
cache.agents = [];
cache.agentsInitialized = false;
cache.region = [];
cache.regionInitialized = false;

var drawCell = window.drawCell = function(x, y, cell) {
  var graphic = cell.hasAgent ? cache.agents[cell.agentID].species : cell.terrain;
  
  ctx.hermesRedraw(graphic.char, 2 + 8*x, 2 + 12*y, 1, graphic.color);
}

var drawRegion = window.drawRegion = function() {
  cache.region.forEach(function(v, i) {
    v.forEach(function(w, j) {
      drawCell(i, j, w);
    });
  });
}

// Uses same inheritance as buffer.Buffer
// Standard inheritance does not work well (or at all?) with JS typed arrays
var NH_Buffer = window.NH_Buffer = function NH_Buffer() {
  var buf = buffer.Buffer.apply(this, arguments);
  
  buf.readNH_Agent = function readNH_Agent(offset) {
    return Particles.Agent.fromBuffer(this, offset);
  }
  
  buf.readNH_Cell = function readNH_Cell(offset) {
    return Particles.Cell.fromBuffer(this, offset);
  }
  
  return buf;
}

var wsMessageHandler = window.wsMessageHandler = function(e) {
  if(e.data.constructor.name === 'Blob') {
    var fileReader = new FileReader();
    
    fileReader.onload = function(e) {
      //var bytes = new buffer.Buffer(new Uint8Array(fileReader.result));
      var bytes = new NH_Buffer(new Uint8Array(fileReader.result));
      
      var packet = Packets.fromBuffer(bytes);
      
      switch(packet.type) {
        case 'region-properties':
          break;
        case 'cell-cache':
          for(var i = 0, endi = packet.width; i < endi; ++i) {
            cache.region[i] = [];
            
            for(var j = 0, endj = packet.height; j < endj; ++j) {
              cache.region[i][j] = packet.array[i*packet.height + j];
            }
          }
          
          cache.regionInitialized = true;
          
          if(cache.agentsInitialized) {
            drawRegion();
          }
          
          break;
        case 'agent-cache':
          cache.agents = packet.array;
          
          cache.agentsInitialized = true;
          
          if(cache.regionInitialized) {
            drawRegion();
          }
          
          break;
        case 'cell-update':
          packet.array.forEach(function(v) {
            cache.region[v.x][v.y] = v;
            
            drawCell(v.x, v.y, cache.region[v.x][v.y]);
          });
          
          break;
      }
    }
    
    fileReader.readAsArrayBuffer(e.data);
  }
}

var wstest = window.wstest = new PersistentWS({url: window.location.protocol.replace('http', 'ws') + '//' + window.location.host});

wstest.addEventListener('message', wsMessageHandler);
wstest.addEventListener('open', function() {
  wstest.socket.send(JSON.stringify({req: 'region-properties'}))
  wstest.socket.send(JSON.stringify({req: 'region-agents'}));
  wstest.socket.send(JSON.stringify({req: 'region'}))
});

/////////////////////
// Startup scripts //
/////////////////////

eval(localStorage.onstart);


},{"./bower_components/buffer/":2,"./bower_components/hermes/":3,"./bower_components/persistent-ws/":4}],2:[function(require,module,exports){
(function (global){
/** 'buffer' nodejs module minified for AMD, CommonJS & `window.buffer`. browserify v3.46.1 **/
!function(t){if("object"==typeof exports)module.exports=t();else if("function"==typeof define&&define.amd)define(t);else{var e;"undefined"!=typeof window?e=window:"undefined"!=typeof global?e=global:"undefined"!=typeof self&&(e=self),e.buffer=t()}}(function(){return function t(e,n,r){function i(a,u){if(!n[a]){if(!e[a]){var s="function"==typeof require&&require;if(!u&&s)return s(a,!0);if(o)return o(a,!0);throw new Error("Cannot find module '"+a+"'")}var f=n[a]={exports:{}};e[a][0].call(f.exports,function(t){var n=e[a][1][t];return i(n?n:t)},f,f.exports,t,e,n,r)}return n[a].exports}for(var o="function"==typeof require&&require,a=0;a<r.length;a++)i(r[a]);return i}({1:[function(t,e,n){function r(t,e,n){if(!(this instanceof r))return new r(t,e,n);var i=typeof t;if("base64"===e&&"string"===i)for(t=C(t);t.length%4!==0;)t+="=";var o;if("number"===i)o=T(t);else if("string"===i)o=r.byteLength(t,e);else{if("object"!==i)throw new Error("First argument needs to be a number, array or string.");o=T(t.length)}var a;r._useTypedArrays?a=r._augment(new Uint8Array(o)):(a=this,a.length=o,a._isBuffer=!0);var u;if(r._useTypedArrays&&"number"==typeof t.byteLength)a._set(t);else if(M(t))for(u=0;o>u;u++)a[u]=r.isBuffer(t)?t.readUInt8(u):t[u];else if("string"===i)a.write(t,0,e);else if("number"===i&&!r._useTypedArrays&&!n)for(u=0;o>u;u++)a[u]=0;return a}function i(t,e,n,i){n=Number(n)||0;var o=t.length-n;i?(i=Number(i),i>o&&(i=o)):i=o;var a=e.length;R(a%2===0,"Invalid hex string"),i>a/2&&(i=a/2);for(var u=0;i>u;u++){var s=parseInt(e.substr(2*u,2),16);R(!isNaN(s),"Invalid hex string"),t[n+u]=s}return r._charsWritten=2*u,u}function o(t,e,n,i){var o=r._charsWritten=W(x(e),t,n,i);return o}function a(t,e,n,i){var o=r._charsWritten=W(F(e),t,n,i);return o}function u(t,e,n,r){return a(t,e,n,r)}function s(t,e,n,i){var o=r._charsWritten=W(j(e),t,n,i);return o}function f(t,e,n,i){var o=r._charsWritten=W(D(e),t,n,i);return o}function l(t,e,n){return X.fromByteArray(0===e&&n===t.length?t:t.slice(e,n))}function h(t,e,n){var r="",i="";n=Math.min(t.length,n);for(var o=e;n>o;o++)t[o]<=127?(r+=q(i)+String.fromCharCode(t[o]),i=""):i+="%"+t[o].toString(16);return r+q(i)}function c(t,e,n){var r="";n=Math.min(t.length,n);for(var i=e;n>i;i++)r+=String.fromCharCode(t[i]);return r}function g(t,e,n){return c(t,e,n)}function d(t,e,n){var r=t.length;(!e||0>e)&&(e=0),(!n||0>n||n>r)&&(n=r);for(var i="",o=e;n>o;o++)i+=N(t[o]);return i}function p(t,e,n){for(var r=t.slice(e,n),i="",o=0;o<r.length;o+=2)i+=String.fromCharCode(r[o]+256*r[o+1]);return i}function y(t,e,n,r){r||(R("boolean"==typeof n,"missing or invalid endian"),R(void 0!==e&&null!==e,"missing offset"),R(e+1<t.length,"Trying to read beyond buffer length"));var i=t.length;if(!(e>=i)){var o;return n?(o=t[e],i>e+1&&(o|=t[e+1]<<8)):(o=t[e]<<8,i>e+1&&(o|=t[e+1])),o}}function v(t,e,n,r){r||(R("boolean"==typeof n,"missing or invalid endian"),R(void 0!==e&&null!==e,"missing offset"),R(e+3<t.length,"Trying to read beyond buffer length"));var i=t.length;if(!(e>=i)){var o;return n?(i>e+2&&(o=t[e+2]<<16),i>e+1&&(o|=t[e+1]<<8),o|=t[e],i>e+3&&(o+=t[e+3]<<24>>>0)):(i>e+1&&(o=t[e+1]<<16),i>e+2&&(o|=t[e+2]<<8),i>e+3&&(o|=t[e+3]),o+=t[e]<<24>>>0),o}}function b(t,e,n,r){r||(R("boolean"==typeof n,"missing or invalid endian"),R(void 0!==e&&null!==e,"missing offset"),R(e+1<t.length,"Trying to read beyond buffer length"));var i=t.length;if(!(e>=i)){var o=y(t,e,n,!0),a=32768&o;return a?-1*(65535-o+1):o}}function w(t,e,n,r){r||(R("boolean"==typeof n,"missing or invalid endian"),R(void 0!==e&&null!==e,"missing offset"),R(e+3<t.length,"Trying to read beyond buffer length"));var i=t.length;if(!(e>=i)){var o=v(t,e,n,!0),a=2147483648&o;return a?-1*(4294967295-o+1):o}}function m(t,e,n,r){return r||(R("boolean"==typeof n,"missing or invalid endian"),R(e+3<t.length,"Trying to read beyond buffer length")),Y.read(t,e,n,23,4)}function E(t,e,n,r){return r||(R("boolean"==typeof n,"missing or invalid endian"),R(e+7<t.length,"Trying to read beyond buffer length")),Y.read(t,e,n,52,8)}function I(t,e,n,r,i){i||(R(void 0!==e&&null!==e,"missing value"),R("boolean"==typeof r,"missing or invalid endian"),R(void 0!==n&&null!==n,"missing offset"),R(n+1<t.length,"trying to write beyond buffer length"),O(e,65535));var o=t.length;if(!(n>=o))for(var a=0,u=Math.min(o-n,2);u>a;a++)t[n+a]=(e&255<<8*(r?a:1-a))>>>8*(r?a:1-a)}function B(t,e,n,r,i){i||(R(void 0!==e&&null!==e,"missing value"),R("boolean"==typeof r,"missing or invalid endian"),R(void 0!==n&&null!==n,"missing offset"),R(n+3<t.length,"trying to write beyond buffer length"),O(e,4294967295));var o=t.length;if(!(n>=o))for(var a=0,u=Math.min(o-n,4);u>a;a++)t[n+a]=e>>>8*(r?a:3-a)&255}function A(t,e,n,r,i){i||(R(void 0!==e&&null!==e,"missing value"),R("boolean"==typeof r,"missing or invalid endian"),R(void 0!==n&&null!==n,"missing offset"),R(n+1<t.length,"Trying to write beyond buffer length"),J(e,32767,-32768));var o=t.length;n>=o||(e>=0?I(t,e,n,r,i):I(t,65535+e+1,n,r,i))}function U(t,e,n,r,i){i||(R(void 0!==e&&null!==e,"missing value"),R("boolean"==typeof r,"missing or invalid endian"),R(void 0!==n&&null!==n,"missing offset"),R(n+3<t.length,"Trying to write beyond buffer length"),J(e,2147483647,-2147483648));var o=t.length;n>=o||(e>=0?B(t,e,n,r,i):B(t,4294967295+e+1,n,r,i))}function L(t,e,n,r,i){i||(R(void 0!==e&&null!==e,"missing value"),R("boolean"==typeof r,"missing or invalid endian"),R(void 0!==n&&null!==n,"missing offset"),R(n+3<t.length,"Trying to write beyond buffer length"),P(e,3.4028234663852886e38,-3.4028234663852886e38));var o=t.length;n>=o||Y.write(t,e,n,r,23,4)}function S(t,e,n,r,i){i||(R(void 0!==e&&null!==e,"missing value"),R("boolean"==typeof r,"missing or invalid endian"),R(void 0!==n&&null!==n,"missing offset"),R(n+7<t.length,"Trying to write beyond buffer length"),P(e,1.7976931348623157e308,-1.7976931348623157e308));var o=t.length;n>=o||Y.write(t,e,n,r,52,8)}function C(t){return t.trim?t.trim():t.replace(/^\s+|\s+$/g,"")}function _(t,e,n){return"number"!=typeof t?n:(t=~~t,t>=e?e:t>=0?t:(t+=e,t>=0?t:0))}function T(t){return t=~~Math.ceil(+t),0>t?0:t}function k(t){return(Array.isArray||function(t){return"[object Array]"===Object.prototype.toString.call(t)})(t)}function M(t){return k(t)||r.isBuffer(t)||t&&"object"==typeof t&&"number"==typeof t.length}function N(t){return 16>t?"0"+t.toString(16):t.toString(16)}function x(t){for(var e=[],n=0;n<t.length;n++){var r=t.charCodeAt(n);if(127>=r)e.push(t.charCodeAt(n));else{var i=n;r>=55296&&57343>=r&&n++;for(var o=encodeURIComponent(t.slice(i,n+1)).substr(1).split("%"),a=0;a<o.length;a++)e.push(parseInt(o[a],16))}}return e}function F(t){for(var e=[],n=0;n<t.length;n++)e.push(255&t.charCodeAt(n));return e}function D(t){for(var e,n,r,i=[],o=0;o<t.length;o++)e=t.charCodeAt(o),n=e>>8,r=e%256,i.push(r),i.push(n);return i}function j(t){return X.toByteArray(t)}function W(t,e,n,r){for(var i=0;r>i&&!(i+n>=e.length||i>=t.length);i++)e[i+n]=t[i];return i}function q(t){try{return decodeURIComponent(t)}catch(e){return String.fromCharCode(65533)}}function O(t,e){R("number"==typeof t,"cannot write a non-number as a number"),R(t>=0,"specified a negative value for writing an unsigned value"),R(e>=t,"value is larger than maximum value for type"),R(Math.floor(t)===t,"value has a fractional component")}function J(t,e,n){R("number"==typeof t,"cannot write a non-number as a number"),R(e>=t,"value larger than maximum allowed value"),R(t>=n,"value smaller than minimum allowed value"),R(Math.floor(t)===t,"value has a fractional component")}function P(t,e,n){R("number"==typeof t,"cannot write a non-number as a number"),R(e>=t,"value larger than maximum allowed value"),R(t>=n,"value smaller than minimum allowed value")}function R(t,e){if(!t)throw new Error(e||"Failed assertion")}var X=t("base64-js"),Y=t("ieee754");n.Buffer=r,n.SlowBuffer=r,n.INSPECT_MAX_BYTES=50,r.poolSize=8192,r._useTypedArrays=function(){try{var t=new ArrayBuffer(0),e=new Uint8Array(t);return e.foo=function(){return 42},42===e.foo()&&"function"==typeof e.subarray}catch(n){return!1}}(),r.isEncoding=function(t){switch(String(t).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"binary":case"base64":case"raw":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},r.isBuffer=function(t){return!(null===t||void 0===t||!t._isBuffer)},r.byteLength=function(t,e){var n;switch(t+="",e||"utf8"){case"hex":n=t.length/2;break;case"utf8":case"utf-8":n=x(t).length;break;case"ascii":case"binary":case"raw":n=t.length;break;case"base64":n=j(t).length;break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":n=2*t.length;break;default:throw new Error("Unknown encoding")}return n},r.concat=function(t,e){if(R(k(t),"Usage: Buffer.concat(list, [totalLength])\nlist should be an Array."),0===t.length)return new r(0);if(1===t.length)return t[0];var n;if("number"!=typeof e)for(e=0,n=0;n<t.length;n++)e+=t[n].length;var i=new r(e),o=0;for(n=0;n<t.length;n++){var a=t[n];a.copy(i,o),o+=a.length}return i},r.prototype.write=function(t,e,n,r){if(isFinite(e))isFinite(n)||(r=n,n=void 0);else{var l=r;r=e,e=n,n=l}e=Number(e)||0;var h=this.length-e;n?(n=Number(n),n>h&&(n=h)):n=h,r=String(r||"utf8").toLowerCase();var c;switch(r){case"hex":c=i(this,t,e,n);break;case"utf8":case"utf-8":c=o(this,t,e,n);break;case"ascii":c=a(this,t,e,n);break;case"binary":c=u(this,t,e,n);break;case"base64":c=s(this,t,e,n);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":c=f(this,t,e,n);break;default:throw new Error("Unknown encoding")}return c},r.prototype.toString=function(t,e,n){var r=this;if(t=String(t||"utf8").toLowerCase(),e=Number(e)||0,n=void 0!==n?Number(n):n=r.length,n===e)return"";var i;switch(t){case"hex":i=d(r,e,n);break;case"utf8":case"utf-8":i=h(r,e,n);break;case"ascii":i=c(r,e,n);break;case"binary":i=g(r,e,n);break;case"base64":i=l(r,e,n);break;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":i=p(r,e,n);break;default:throw new Error("Unknown encoding")}return i},r.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}},r.prototype.copy=function(t,e,n,i){var o=this;if(n||(n=0),i||0===i||(i=this.length),e||(e=0),i!==n&&0!==t.length&&0!==o.length){R(i>=n,"sourceEnd < sourceStart"),R(e>=0&&e<t.length,"targetStart out of bounds"),R(n>=0&&n<o.length,"sourceStart out of bounds"),R(i>=0&&i<=o.length,"sourceEnd out of bounds"),i>this.length&&(i=this.length),t.length-e<i-n&&(i=t.length-e+n);var a=i-n;if(100>a||!r._useTypedArrays)for(var u=0;a>u;u++)t[u+e]=this[u+n];else t._set(this.subarray(n,n+a),e)}},r.prototype.slice=function(t,e){var n=this.length;if(t=_(t,n,0),e=_(e,n,n),r._useTypedArrays)return r._augment(this.subarray(t,e));for(var i=e-t,o=new r(i,void 0,!0),a=0;i>a;a++)o[a]=this[a+t];return o},r.prototype.get=function(t){return console.log(".get() is deprecated. Access using array indexes instead."),this.readUInt8(t)},r.prototype.set=function(t,e){return console.log(".set() is deprecated. Access using array indexes instead."),this.writeUInt8(t,e)},r.prototype.readUInt8=function(t,e){return e||(R(void 0!==t&&null!==t,"missing offset"),R(t<this.length,"Trying to read beyond buffer length")),t>=this.length?void 0:this[t]},r.prototype.readUInt16LE=function(t,e){return y(this,t,!0,e)},r.prototype.readUInt16BE=function(t,e){return y(this,t,!1,e)},r.prototype.readUInt32LE=function(t,e){return v(this,t,!0,e)},r.prototype.readUInt32BE=function(t,e){return v(this,t,!1,e)},r.prototype.readInt8=function(t,e){if(e||(R(void 0!==t&&null!==t,"missing offset"),R(t<this.length,"Trying to read beyond buffer length")),!(t>=this.length)){var n=128&this[t];return n?-1*(255-this[t]+1):this[t]}},r.prototype.readInt16LE=function(t,e){return b(this,t,!0,e)},r.prototype.readInt16BE=function(t,e){return b(this,t,!1,e)},r.prototype.readInt32LE=function(t,e){return w(this,t,!0,e)},r.prototype.readInt32BE=function(t,e){return w(this,t,!1,e)},r.prototype.readFloatLE=function(t,e){return m(this,t,!0,e)},r.prototype.readFloatBE=function(t,e){return m(this,t,!1,e)},r.prototype.readDoubleLE=function(t,e){return E(this,t,!0,e)},r.prototype.readDoubleBE=function(t,e){return E(this,t,!1,e)},r.prototype.writeUInt8=function(t,e,n){n||(R(void 0!==t&&null!==t,"missing value"),R(void 0!==e&&null!==e,"missing offset"),R(e<this.length,"trying to write beyond buffer length"),O(t,255)),e>=this.length||(this[e]=t)},r.prototype.writeUInt16LE=function(t,e,n){I(this,t,e,!0,n)},r.prototype.writeUInt16BE=function(t,e,n){I(this,t,e,!1,n)},r.prototype.writeUInt32LE=function(t,e,n){B(this,t,e,!0,n)},r.prototype.writeUInt32BE=function(t,e,n){B(this,t,e,!1,n)},r.prototype.writeInt8=function(t,e,n){n||(R(void 0!==t&&null!==t,"missing value"),R(void 0!==e&&null!==e,"missing offset"),R(e<this.length,"Trying to write beyond buffer length"),J(t,127,-128)),e>=this.length||(t>=0?this.writeUInt8(t,e,n):this.writeUInt8(255+t+1,e,n))},r.prototype.writeInt16LE=function(t,e,n){A(this,t,e,!0,n)},r.prototype.writeInt16BE=function(t,e,n){A(this,t,e,!1,n)},r.prototype.writeInt32LE=function(t,e,n){U(this,t,e,!0,n)},r.prototype.writeInt32BE=function(t,e,n){U(this,t,e,!1,n)},r.prototype.writeFloatLE=function(t,e,n){L(this,t,e,!0,n)},r.prototype.writeFloatBE=function(t,e,n){L(this,t,e,!1,n)},r.prototype.writeDoubleLE=function(t,e,n){S(this,t,e,!0,n)},r.prototype.writeDoubleBE=function(t,e,n){S(this,t,e,!1,n)},r.prototype.fill=function(t,e,n){if(t||(t=0),e||(e=0),n||(n=this.length),"string"==typeof t&&(t=t.charCodeAt(0)),R("number"==typeof t&&!isNaN(t),"value is not a number"),R(n>=e,"end < start"),n!==e&&0!==this.length){R(e>=0&&e<this.length,"start out of bounds"),R(n>=0&&n<=this.length,"end out of bounds");for(var r=e;n>r;r++)this[r]=t}},r.prototype.inspect=function(){for(var t=[],e=this.length,r=0;e>r;r++)if(t[r]=N(this[r]),r===n.INSPECT_MAX_BYTES){t[r+1]="...";break}return"<Buffer "+t.join(" ")+">"},r.prototype.toArrayBuffer=function(){if("undefined"!=typeof Uint8Array){if(r._useTypedArrays)return new r(this).buffer;for(var t=new Uint8Array(this.length),e=0,n=t.length;n>e;e+=1)t[e]=this[e];return t.buffer}throw new Error("Buffer.toArrayBuffer not supported in this browser")};var z=r.prototype;r._augment=function(t){return t._isBuffer=!0,t._get=t.get,t._set=t.set,t.get=z.get,t.set=z.set,t.write=z.write,t.toString=z.toString,t.toLocaleString=z.toString,t.toJSON=z.toJSON,t.copy=z.copy,t.slice=z.slice,t.readUInt8=z.readUInt8,t.readUInt16LE=z.readUInt16LE,t.readUInt16BE=z.readUInt16BE,t.readUInt32LE=z.readUInt32LE,t.readUInt32BE=z.readUInt32BE,t.readInt8=z.readInt8,t.readInt16LE=z.readInt16LE,t.readInt16BE=z.readInt16BE,t.readInt32LE=z.readInt32LE,t.readInt32BE=z.readInt32BE,t.readFloatLE=z.readFloatLE,t.readFloatBE=z.readFloatBE,t.readDoubleLE=z.readDoubleLE,t.readDoubleBE=z.readDoubleBE,t.writeUInt8=z.writeUInt8,t.writeUInt16LE=z.writeUInt16LE,t.writeUInt16BE=z.writeUInt16BE,t.writeUInt32LE=z.writeUInt32LE,t.writeUInt32BE=z.writeUInt32BE,t.writeInt8=z.writeInt8,t.writeInt16LE=z.writeInt16LE,t.writeInt16BE=z.writeInt16BE,t.writeInt32LE=z.writeInt32LE,t.writeInt32BE=z.writeInt32BE,t.writeFloatLE=z.writeFloatLE,t.writeFloatBE=z.writeFloatBE,t.writeDoubleLE=z.writeDoubleLE,t.writeDoubleBE=z.writeDoubleBE,t.fill=z.fill,t.inspect=z.inspect,t.toArrayBuffer=z.toArrayBuffer,t}},{"base64-js":2,ieee754:3}],2:[function(t,e,n){var r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";!function(t){"use strict";function e(t){var e=t.charCodeAt(0);return e===a?62:e===u?63:s>e?-1:s+10>e?e-s+26+26:l+26>e?e-l:f+26>e?e-f+26:void 0}function n(t){function n(t){f[h++]=t}var r,i,a,u,s,f;if(t.length%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var l=t.length;s="="===t.charAt(l-2)?2:"="===t.charAt(l-1)?1:0,f=new o(3*t.length/4-s),a=s>0?t.length-4:t.length;var h=0;for(r=0,i=0;a>r;r+=4,i+=3)u=e(t.charAt(r))<<18|e(t.charAt(r+1))<<12|e(t.charAt(r+2))<<6|e(t.charAt(r+3)),n((16711680&u)>>16),n((65280&u)>>8),n(255&u);return 2===s?(u=e(t.charAt(r))<<2|e(t.charAt(r+1))>>4,n(255&u)):1===s&&(u=e(t.charAt(r))<<10|e(t.charAt(r+1))<<4|e(t.charAt(r+2))>>2,n(u>>8&255),n(255&u)),f}function i(t){function e(t){return r.charAt(t)}function n(t){return e(t>>18&63)+e(t>>12&63)+e(t>>6&63)+e(63&t)}var i,o,a,u=t.length%3,s="";for(i=0,a=t.length-u;a>i;i+=3)o=(t[i]<<16)+(t[i+1]<<8)+t[i+2],s+=n(o);switch(u){case 1:o=t[t.length-1],s+=e(o>>2),s+=e(o<<4&63),s+="==";break;case 2:o=(t[t.length-2]<<8)+t[t.length-1],s+=e(o>>10),s+=e(o>>4&63),s+=e(o<<2&63),s+="="}return s}var o="undefined"!=typeof Uint8Array?Uint8Array:Array,a="+".charCodeAt(0),u="/".charCodeAt(0),s="0".charCodeAt(0),f="a".charCodeAt(0),l="A".charCodeAt(0);t.toByteArray=n,t.fromByteArray=i}("undefined"==typeof n?this.base64js={}:n)},{}],3:[function(t,e,n){n.read=function(t,e,n,r,i){var o,a,u=8*i-r-1,s=(1<<u)-1,f=s>>1,l=-7,h=n?i-1:0,c=n?-1:1,g=t[e+h];for(h+=c,o=g&(1<<-l)-1,g>>=-l,l+=u;l>0;o=256*o+t[e+h],h+=c,l-=8);for(a=o&(1<<-l)-1,o>>=-l,l+=r;l>0;a=256*a+t[e+h],h+=c,l-=8);if(0===o)o=1-f;else{if(o===s)return a?0/0:1/0*(g?-1:1);a+=Math.pow(2,r),o-=f}return(g?-1:1)*a*Math.pow(2,o-r)},n.write=function(t,e,n,r,i,o){var a,u,s,f=8*o-i-1,l=(1<<f)-1,h=l>>1,c=23===i?Math.pow(2,-24)-Math.pow(2,-77):0,g=r?0:o-1,d=r?1:-1,p=0>e||0===e&&0>1/e?1:0;for(e=Math.abs(e),isNaN(e)||1/0===e?(u=isNaN(e)?1:0,a=l):(a=Math.floor(Math.log(e)/Math.LN2),e*(s=Math.pow(2,-a))<1&&(a--,s*=2),e+=a+h>=1?c/s:c*Math.pow(2,1-h),e*s>=2&&(a++,s/=2),a+h>=l?(u=0,a=l):a+h>=1?(u=(e*s-1)*Math.pow(2,i),a+=h):(u=e*Math.pow(2,h-1)*Math.pow(2,i),a=0));i>=8;t[n+g]=255&u,g+=d,u/=256,i-=8);for(a=a<<i|u,f+=i;f>0;t[n+g]=255&a,g+=d,a/=256,f-=8);t[n+g-d]|=128*p}},{}],4:[function(t,e){e.exports=t("buffer")},{buffer:1}]},{},[4])(4)});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
/**
 * @description This is essentilly a hackish raster font for html canvases
 * @description Characters are 8 pixels wide; lines are 12 pixels high
 * @description Adds two methods to the browser's CanvasRenderingContext2D prototype
 */

/**
 * @module HERMES
 */
var HERMES = (function() { // Module pattern
  var exports = {};
  
  // @prop Number CHAR_WIDTH -- Width of a char. Is 8
  var CHAR_WIDTH = exports.CHAR_WIDTH = 8;
  
  // @prop Number CHAR_HEIGHT -- Height of a char. Is 12
  var CHAR_HEIGHT = exports.CHAR_HEIGHT = 12;
  
  // @prop Object DRAW_CALLS -- Holds coordinates used in .fillRect() calls for each ascii character
  var DRAW_CALLS = exports.DRAW_CALLS = {
    ' ' : [],
    '!' : [[1,  2, 1,  3], [2,  1, 2,  6], [2,  8, 2,  2], [4,  2, 1,  3]],
    '"' : [[1,  1, 2,  3], [2,  4, 1,  1], [5,  1, 2,  3], [5,  4, 1,  1]],
    '#' : [[0,  3, 7,  1], [0,  7, 7,  1], [1,  1, 2,  2], [1,  4, 2,  3], [1,  8, 2,  2], [4,  1, 2,  2], [4,  4, 2,  3], [4,  8, 2,  2]],
    '$' : [[2,  0, 2,  2], [1,  2, 5,  1], [0,  3, 2,  2], [1,  5, 4,  1], [4,  6, 2,  2], [0,  8, 5,  1], [2,  9, 2,  2]],
    '%' : [[0,  3, 2,  2], [5,  3, 1,  1], [4,  4, 2,  1], [3,  5, 2,  1], [2,  6, 2,  1], [1,  7, 2,  1], [0,  8, 2,  1], [0,  9, 1,  1], [4,  8, 2,  2]],
    '&' : [[1,  1, 3,  1], [0,  2, 2,  2], [3,  2, 2,  2], [1,  4, 3,  1], [0,  5, 2,  4], [2,  5, 3,  1], [3,  6, 4,  1], [6,  5, 1,  1], [4,  7, 2,  2], [3,  8, 1,  1], [1,  9, 3,  1], [5,  9, 2,  1]],
    '\'': [[2,  1, 2,  3], [1,  4, 2,  1]],
    '(' : [[4,  1, 2,  1], [3,  2, 2,  1], [2,  3, 2,  5], [3,  8, 2,  1], [4,  9, 2,  1]],
    ')' : [[2,  1, 2,  1], [3,  2, 2,  1], [4,  3, 2,  5], [3,  8, 2,  1], [2,  9, 2,  1]],
    '*' : [[1,  3, 2,  1], [5,  3, 2,  1], [2,  4, 4,  1], [0,  5, 8,  1], [2,  6, 4,  1], [1,  7, 2,  1], [5,  7, 2,  1]],
    '+' : [[3,  3, 2,  2], [1,  5, 6,  1], [3,  6, 2,  2]],
    ',' : [[2,  8, 3,  2], [1,  10, 2,  1]],
    '-' : [[0,  5, 7,  1]],
    '.' : [[2,  8, 3,  2]],
    '/' : [[6,  2, 1,  1], [5,  3, 2,  1], [4,  4, 2,  1], [3,  5, 2,  1], [2,  6, 2,  1], [1,  7, 2,  1], [0,  8, 2,  1], [0,  9, 1,  1]],
    '0' : [[1,  1, 5,  1], [0,  2, 2,  7], [2,  6, 1,  2], [3,  4, 1,  3], [4,  3, 1,  2], [5,  2, 2,  7], [1,  9, 5,  1]],
    '1' : [[0,  3, 2,  1], [2,  2, 2,  7], [3,  1, 1,  1], [0,  9, 6,  1]],
    '2' : [[1,  1, 4,  1], [0,  2, 2,  2], [4,  2, 2,  3], [3,  5, 2,  1], [2,  6, 2,  1], [1,  7, 2,  1], [0,  8, 2,  1], [4,  8, 2,  1], [0,  9, 6,  1]],
    '3' : [[1,  1, 4,  1], [0,  2, 2,  1], [4,  2, 2,  3], [2,  5, 3,  1], [4,  6, 2,  3], [0,  8, 2,  1], [1,  9, 4,  1]],
    '4' : [[4,  1, 2,  8], [3,  2, 1,  1], [2,  3, 2,  1], [1,  4, 2,  1], [0,  5, 2,  1], [0,  6, 4,  1], [6,  6, 1,  1], [3,  9, 4,  1]],
    '5' : [[0,  1, 6,  1], [0,  2, 2,  3], [0,  5, 5,  1], [4,  6, 2,  3], [0,  8, 2,  1], [1,  9, 4,  1]],
    '6' : [[2,  1, 3,  1], [1,  2, 2,  1], [0,  3, 2,  6], [2,  5, 3,  1], [4,  6, 2,  3], [1,  9, 4,  1]],
    '7' : [[0,  1, 7,  1], [0,  2, 2,  2], [5,  2, 2,  3], [4,  5, 2,  1], [3,  6, 2,  1], [2,  7, 2,  3]],
    '8' : [[1,  1, 4,  1], [0,  2, 2,  3], [4,  2, 2,  3], [2,  4, 1,  1], [1,  5, 4,  1], [3,  6, 1,  1], [0,  6, 2,  3], [4,  6, 2,  3], [1,  9, 4,  1]],
    '9' : [[1,  1, 4,  1], [0,  2, 2,  3], [4,  2, 2,  3], [1,  5, 4,  1], [3,  6, 2,  2], [2,  8, 2,  1], [1,  9, 3,  1]],
    ':' : [[2,  3, 3,  2], [2,  7, 3,  2]],
    ';' : [[2,  3, 3,  2], [2,  7, 3,  2], [3,  9, 2,  1], [2, 10, 2,  1]],
    '<' : [[4,  1, 2,  1], [3,  2, 2,  1], [2,  3, 2,  1], [1,  4, 2,  1], [0,  5, 2,  1], [1,  6, 2,  1], [2,  7, 2,  1], [3,  8, 2,  1], [4,  9, 2,  1]],
    '=' : [[1,  4, 6,  1], [1,  6, 6,  1]],
    '>' : [[1,  1, 2,  1], [2,  2, 2,  1], [3,  3, 2,  1], [4,  4, 2,  1], [5,  5, 2,  1], [4,  6, 2,  1], [3,  7, 2,  1], [2,  8, 2,  1], [1,  9, 2,  1]],
    '?' : [[1,  1, 4,  1], [0,  2, 2,  1], [4,  2, 2,  2], [3,  4, 2,  1], [2,  5, 2,  2], [2,  8, 2,  2]],
    '@' : [[1,  1, 5,  1], [0,  2, 2,  7], [5,  2, 2,  2], [3,  4, 4,  3], [1,  9, 5,  1]],
    'A' : [[2,  1, 2,  1], [1,  2, 4,  1], [0,  3, 2,  7], [4,  3, 2,  7], [2,  6, 2,  1]],
    'B' : [[0,  1, 6,  1], [1,  2, 2,  7], [5,  2, 2,  3], [3,  5, 3,  1], [5,  6, 2,  3], [0,  9, 6,  1]],
    'C' : [[2,  1, 4,  1], [1,  2, 2,  1], [5,  2, 2,  2], [0,  3, 2,  5], [5,  7, 2,  2], [1,  8, 2,  1], [2,  9, 4,  1]],
    'D' : [[0,  1, 5,  1], [1,  2, 2,  7], [4,  2, 2,  1], [5,  3, 2,  5], [4,  8, 2,  1], [0,  9, 5,  1]],
    'E' : [[0,  1, 7,  1], [6,  2, 1,  1], [1,  2, 2,  7], [3,  5, 2,  1], [5,  4, 1,  3], [6,  8, 1,  1], [0,  9, 7,  1]],
    'F' : [[0,  1, 7,  1], [5,  2, 2,  1], [6,  3, 1,  1], [1,  2, 2,  7], [3,  5, 2,  1], [5,  4, 1,  3], [0,  9, 4,  1]],
    'G' : [[2,  1, 4,  1], [1,  2, 2,  1], [5,  2, 2,  2], [0,  3, 2,  5], [1,  8, 2,  1], [2,  9, 3,  1], [5,  6, 2,  4], [4,  6, 1,  1]],
    'H' : [[0,  1, 2,  9], [2,  5, 2,  1], [4,  1, 2,  9]],
    'I' : [[1,  1, 4,  1], [2,  2, 2,  7], [1,  9, 4,  1]],
    'J' : [[0,  6, 2,  3], [1,  9, 4,  1], [4,  2, 2,  7], [3,  1, 4,  1]],
    'K' : [[0,  1, 3,  1], [1,  2, 2,  7], [0,  9, 3,  1], [5,  1, 2,  2], [4,  3, 2,  2], [3,  5, 2,  1], [4,  6, 2,  2], [5,  8, 2,  2]],
    'L' : [[0,  1, 4,  1], [1,  2, 2,  7], [0,  9, 7,  1], [5,  7, 2,  2], [6,  6, 1,  1]],
    'M' : [[0,  1, 2,  9], [2,  2, 1,  3], [3,  3, 1,  3], [4,  2, 1,  3], [5,  1, 2,  9]],
    'N' : [[0,  1, 2,  9], [2,  3, 1,  3], [3,  4, 1,  3], [4,  5, 1,  3], [5,  1, 2,  9]],
    'O' : [[2,  1, 3,  1], [1,  2, 2,  1], [4,  2, 2,  1], [0,  3, 2,  5], [5,  3, 2,  5], [1,  8, 2,  1], [4,  8, 2,  1], [2,  9, 3,  1]],
    'P' : [[0,  1, 6,  1], [1,  2, 2,  7], [5,  2, 2,  3], [3,  5, 3,  1], [0,  9, 4,  1]],
    'Q' : [[2,  1, 3,  1], [1,  2, 2,  1], [4,  2, 2,  1], [0,  3, 2,  5], [5,  3, 2,  5], [1,  8, 5,  1], [3,  7, 1,  1], [4,  6, 1,  2], [4,  9, 2,  1], [3, 10, 4,  1]],
    'R' : [[0,  1, 6,  1], [1,  2, 2,  7], [5,  2, 2,  3], [3,  5, 3,  1], [0,  9, 3,  1], [4,  6, 2,  1], [5,  7, 2,  3]],
    'S' : [[1,  1, 4,  1], [0,  2, 2,  3], [4,  2, 2,  2], [1,  5, 3,  1], [3,  6, 2,  1], [0,  7, 2,  2], [4,  7, 2,  2], [1,  9, 4,  1]],
    'T' : [[0,  1, 6,  1], [0,  2, 1,  1], [5,  2, 1,  1], [2,  2, 2,  7], [1,  9, 4,  1]],
    'U' : [[0,  1, 2,  8], [4,  1, 2,  8], [1,  9, 4,  1]],
    'V' : [[0,  1, 2,  7], [4,  1, 2,  7], [1,  8, 4,  1], [2,  9, 2,  1]],
    'W' : [[0,  1, 2,  6], [5,  1, 2,  6], [3,  5, 1,  2], [1,  7, 2,  3], [4,  7, 2,  3]],
    'X' : [[0,  1, 2,  3], [4,  1, 2,  3], [1,  4, 4,  1], [2,  5, 2,  1], [1,  6, 4,  1], [0,  7, 2,  3], [4,  7, 2,  3]],
    'Y' : [[0,  1, 2,  4], [4,  1, 2,  4], [1,  5, 4,  1], [2,  6, 2,  3], [1,  9, 4,  1]],
    'Z' : [[0,  3, 1,  1], [0,  2, 2,  1], [0,  1, 7,  1], [4,  2, 3,  1], [3,  3, 2,  2], [2,  5, 2,  1], [1,  6, 2,  2], [0,  8, 2,  1], [0,  9, 7,  1], [5,  8, 2,  1], [6,  7, 1,  1]],
    '[' : [[2,  1, 4,  1], [2,  2, 2,  7], [2,  9, 4,  1]],
    '\\': [[0,  2, 1,  2], [1,  3, 1,  2], [2,  4, 1,  2], [3,  5, 1,  2], [4,  6, 1,  2], [5,  7, 1,  2], [6,  8, 1,  2]],
    ']' : [[2,  1, 4,  1], [4,  2, 2,  7], [2,  9, 4,  1]],
    '^' : [[0,  3, 2,  1], [1,  2, 2,  1], [2,  1, 3,  1], [3,  0, 1,  1], [4,  2, 2,  1], [5,  3, 2,  1]],
    '_' : [[0, 10, 8,  1]],
    '`' : [[2,  0, 2,  2], [3,  2, 2,  1]],
    'a' : [[1,  4, 4,  1], [4,  5, 2,  4], [1,  6, 3,  1], [0,  7, 2,  2], [1,  9, 3,  1], [5,  9, 2,  1]],
    'b' : [[0,  1, 3,  1], [1,  2, 2,  7], [3,  4, 3,  1], [5,  5, 2,  4], [0,  9, 2,  1], [3,  9, 3,  1]],
    'c' : [[1,  4, 4,  1], [0,  5, 2,  4], [4,  5, 2,  1], [4,  8, 2,  1], [1,  9, 4,  1]],
    'd' : [[3,  1, 1,  1], [4,  1, 2,  8], [1,  4, 3,  1], [0,  5, 2,  4], [1,  9, 3,  1], [5,  9, 2,  1]],
    'e' : [[1,  4, 4,  1], [0,  5, 2,  4], [4,  5, 2,  1], [2,  6, 4,  1], [4,  8, 2,  1], [1,  9, 4,  1]],
    'f' : [[2,  1, 3,  1], [1,  2, 2,  7], [4,  2, 2,  1], [0,  5, 1,  1], [3,  5, 2,  1], [0,  9, 4,  1]],
    'g' : [[1,  4, 3,  1], [5,  4, 2,  1], [0,  5, 2,  3], [4,  5, 2,  6], [1,  8, 3,  1], [0, 10, 2,  1], [1, 11, 4,  1]],
    'h' : [[0,  1, 3,  1], [1,  2, 2,  7], [4,  4, 2,  1], [3,  5, 1,  1], [5,  5, 2,  5], [0,  9, 3,  1]],
    'i' : [[3,  1, 2,  2], [1,  4, 4,  1], [3,  5, 2,  4], [1,  9, 6,  1]],
    'j' : [[4,  1, 2,  2], [2,  4, 4,  1], [4,  5, 2,  6], [1, 11, 4,  1], [0,  9, 2,  2]],
    'k' : [[0,  1, 3,  1], [1,  2, 2,  7], [5,  4, 2,  1], [4,  5, 2,  1], [3,  6, 2,  1], [4,  7, 2,  1], [5,  8, 2,  2], [0,  9, 3,  1]],
    'l' : [[1,  1, 4,  1], [3,  2, 2,  7], [1,  9, 6,  1]],
    'm' : [[0,  4, 6,  1], [0,  5, 2,  5], [3,  5, 1,  4], [5,  5, 2,  5]],
    'n' : [[0,  4, 5,  1], [0,  5, 2,  5], [4,  5, 2,  5]],
    'o' : [[1,  4, 4,  1], [0,  5, 2,  4], [4,  5, 2,  4], [1,  9, 4,  1]],
    'p' : [[0,  4, 2,  1], [3,  4, 3,  1], [1,  5, 2,  6], [5,  5, 2,  4], [3,  9, 3,  1], [0, 11, 4,  1]],
    'q' : [[1,  4, 3,  1], [5,  4, 2,  1], [0,  5, 2,  4], [4,  5, 2,  6], [1,  9, 3,  1], [3, 11, 4,  1]],
    'r' : [[0,  4, 3,  1], [4,  4, 2,  2], [1,  5, 2,  4], [3,  6, 1,  1], [6,  5, 1,  2], [5,  6, 1,  1], [0,  9, 4,  1]],
    's' : [[1,  4, 4,  1], [0,  5, 2,  1], [4,  5, 2,  1], [1,  6, 2,  1], [3,  7, 2,  1], [0,  8, 2,  1], [4,  8, 2,  1], [1,  9, 4,  1]],
    't' : [[2,  2, 1,  1], [1,  3, 2,  6], [0,  4, 1,  1], [3,  4, 3,  1], [2,  9, 3,  1], [4,  8, 2,  1]],
    'u' : [[0,  4, 2,  5], [4,  4, 2,  5], [1,  9, 3,  1], [5,  9, 2,  1]],
    'v' : [[0,  4, 2,  4], [4,  4, 2,  4], [1,  8, 4,  1], [2,  9, 2,  1]],
    'w' : [[0,  4, 2,  4], [5,  4, 2,  4], [3,  6, 1,  2], [1,  8, 2,  2], [4,  8, 2,  2]],
    'x' : [[0,  4, 2,  1], [5,  4, 2,  1], [1,  5, 2,  1], [4,  5, 2,  1], [2,  6, 3,  2], [1,  8, 2,  1], [4,  8, 2,  1], [0,  9, 2,  1], [5,  9, 2,  1]],
    'y' : [[1,  4, 2,  4], [5,  4, 2,  4], [2,  8, 4,  1], [4,  9, 2,  1], [3, 10, 2,  1], [0, 11, 4,  1]],
    'z' : [[0,  4, 6,  1], [0,  5, 1,  1], [4,  5, 2,  1], [3,  6, 2,  1], [1,  7, 2,  1], [0,  8, 2,  1], [5,  8, 1,  1], [0,  9, 6,  1]],
    '{' : [[3,  1, 3,  1], [2,  2, 2,  2], [1,  4, 2,  1], [0,  5, 2,  1], [1,  6, 2,  1], [2,  7, 2,  2], [3,  9, 3,  1]],
    '|' : [[3,  1, 2,  4], [3,  6, 2,  4]],
    '}' : [[0,  1, 3,  1], [2,  2, 2,  2], [3,  4, 2,  1], [4,  5, 2,  1], [3,  6, 2,  1], [2,  7, 2,  2], [0,  9, 3,  1]],
    '~' : [[0,  2, 2,  2], [1,  1, 3,  1], [3,  2, 2,  1], [4,  3, 3,  1], [6,  2, 1,  1], [6,  1, 2,  1]],
  };
  
  /**
   * @module CanvasRenderingContext2D
   * 
   * @example var ctx = someCanvasElement.getContext('2d');
   * @example ctx.hermesDraw('x', 100, 200); // Draws an 'x' with its top left corner at 100, 200
   * @example ctx.hermesDraw('Hello world!', 100, 200); // Draws 'Hello world!' starting at 100, 200
   * @example ctx.hermesDraw('Hello world!', 100, 200, 7); // Draws 'Hello w' starting at 100, 200
   * @example ctx.hermesDraw('Hello world!', 100, 200, 0); // Draws nothing
   * @example ctx.hermesDraw('Hello world!', 100, 200, null); // Draws 'Hello world!' starting at 100, 200
   * @example ctx.hermesDraw('Hello world!', 100, 200, null, rgb('255, 128, 0')); // Draws 'Hello world!' starting at 100, 200 in orange
   */
  
  // @method proto undefined hermesDraw(String text, Number x, Number y, Number maxWidth, String style) -- Draw a string in antique raster font
  CanvasRenderingContext2D.prototype.hermesDraw = function hermesDraw(text, x, y, maxWidth, style) {
    text = String(text) || ' ';
    
    // If null or undefined, maxWidth defaults to width of text (i.e. no effect)
    if(maxWidth === undefined || maxWidth === null) {
      maxWidth = text.length;
    }
    maxWidth = Number(maxWidth) || 0;
    
    if(text.length <= 0 || maxWidth <= 0) {
      return;
    }
    
    if(style) {
      this.fillStyle = style;
    }
    
    if(DRAW_CALLS[text[0]]) {
      DRAW_CALLS[text[0]].forEach(function(v) {
        this.fillRect(x + v[0], y + v[1], v[2], v[3]);
      }, this);
    }
    
    --maxWidth;
    text = text.substring(1);
    x += CHAR_WIDTH;
    this.hermesDraw(text, x, y, maxWidth);
  }
  
  // @method proto undefined hermesRedraw(String text, Number x, Number y, Number maxWidth, String style) -- Draw a string in antique raster font, clearing the area underneath (clear area determined by maxWidth)
  CanvasRenderingContext2D.prototype.hermesRedraw = function hermesRedraw(text, x, y, maxWidth, style) {
    this.clearRect(x, y, CHAR_WIDTH*maxWidth, CHAR_HEIGHT);
    this.hermesDraw(text, x, y, maxWidth, style);
  }
  
  return exports;
})(); // Module pattern

if(typeof module !== 'undefined' && module !== null && module.exports) {
  module.exports = HERMES;
}

},{}],4:[function(require,module,exports){
(function(root, factory) {
  if(typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  }
  
  if(typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  }
  
  // Browser globals (root is window)
  root.PersistentWS = factory();
}(this, function() {
  /**
   * @description This script provides a persistent WebSocket that attempts to reconnect after disconnections
   */
  
  /**
   * @module PersistentWS
   * @description This is a WebSocket that attempts to reconnect after disconnections
   * @description Reconnection times start at ~5s, double after each failed attempt, and are randomized +/- 10%
   * 
   * @example var persistentConnection = new PersistentWS({url: wss://foo.bar/});
   * @example
   * @example persistentConnection.addEventListener('message', function(message) {
   * @example   console.log('Received: ' + message);
   * @example });
   */
  var PersistentWS = function PersistentWS(options) {
    var self = this;
    
    // @prop String url
    // @option String url
    this.url = String(options.url);
    
    //@prop Boolean silent
    //@option Boolean silent
    this.silent = Boolean(options.silent);
    
    // @prop Number initialRetryTime -- Delay for first retry attempt, in milliseconds. Always an integer >= 100
    this.initialRetryTime = 5000;
    
    // @prop Number attempts -- Retry attempt # since last disconnect
    this.attempts = 0;
    
    // @prop WebSocket socket -- The actual WebSocket. Events registered directly to the raw socket will be lost after reconnections
    this.socket = undefined;
    
    // @prop [[String, Function, Boolean]] _listeners -- For internal use. Array of .addEventListener arguments
    this._listeners = [];
    
    // @method undefined _connect() -- For internal use
    this._connect = function _connect() {
      if(!self.silent) {
        console.log('Opening WebSocket to ' + self.url);
      }
      
      self.socket = new WebSocket(self.url);
      
      // Reset .attempts counter on successful connection
      self.socket.addEventListener('open', function() {
        if(!self.silent) {
          console.log('WebSocket connected to ' + self.url);
        }
        
        self.attempts = 0;
      });
      
      self.socket.addEventListener('close', function() {
        // Retty time falls of exponentially
        var retryTime = self.initialRetryTime*Math.pow(2, self.attempts++);
        
        // Retry time is randomized +/- 10% to prevent clients reconnecting at the exact same time after a server event
        retryTime += Math.floor(Math.random()*retryTime/5 - retryTime/10);
        
        if(!self.silent) {
          console.log('WebSocket disconnected, attempting to reconnect in ' + retryTime + 'ms...');
        }
        
        setTimeout(self._connect, retryTime);
      });
      
      self._listeners.forEach(function(v) {
        self.socket.addEventListener.apply(self.socket, v);
      });
    }
    
    this._connect();
  }
  
  // @method proto undefined addEventListener(String type, Function listener[, Boolean useCapture]) -- Registers event listener on .socket. Event listener will be reregistered after reconnections
  PersistentWS.prototype.addEventListener = function addEventListener(type, listener, useCapture) {
    this.socket.addEventListener(type, listener, useCapture);
    
    var alreadyStored = this._getListenerIndex(type, listener, useCapture) !== -1;
    
    if(!alreadyStored) {
      // Store optional parameter useCapture as Boolean, for consistency with
      // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
      var useCaptureBoolean = Boolean(useCapture);
      
      this._listeners.push([type, listener, useCaptureBoolean]);
    }
  }
  
  // @method proto undefined removeEventListener(String type, Function listener[, Boolean useCapture]) -- Removes an event listener from .socket. Event listener will no longer be reregistered after reconnections
  PersistentWS.prototype.removeEventListener = function removeEventListener(type, listener, useCapture) {
    this.socket.removeEventListener(type, listener, useCapture);
    
    var indexToRemove = this._getListenerIndex(type, listener, useCapture);
    
    if(indexToRemove !== -1) {
      this._listeners.splice(indexToRemove, 1);
    }
  }
  
  // @method proto Boolean dispatchEvent(Event event) -- Same as calling .dispatchEvent() on .socket
  PersistentWS.prototype.dispatchEvent = function(event) {
    return this.socket.dispatchEvent(event);
  }
  
  // @method proto Number _getListenerIndex(String type, Function listener[, Boolean useCapture]) -- For internal use. Returns index of a listener in ._listeners
  PersistentWS.prototype._getListenerIndex = function _getListenerIndex(type, listener, useCapture) {
    // Store optional parameter useCapture as Boolean, for consistency with
    // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
    var useCaptureBoolean = Boolean(useCapture);
    
    var result = -1;
    
    this._listeners.forEach(function(v, i) {
      if(v[0] === type && v[1] === listener && v[2] === useCaptureBoolean) {
        result = i;
      }
    });
    
    return result;
  }
  
  // Only one object to return, so no need for module object to hold it
  return PersistentWS;
})); // Module pattern

},{}]},{},[1]);
