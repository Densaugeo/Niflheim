(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var PersistentWS = window.PersistentWS = require('./bower_components/persistent-ws/PersistentWS.js');
var buffer = window.buffer = require('buffer');
var hermes = window.hermes = require('./bower_components/hermes/Hermes.js');

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


},{"./bower_components/hermes/Hermes.js":2,"./bower_components/persistent-ws/PersistentWS.js":3,"buffer":4}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  function Foo () {}
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    arr.constructor = Foo
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Foo && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined' && object.buffer instanceof ArrayBuffer) {
    return fromTypedArray(that, object)
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []
  var i = 0

  for (; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (leadSurrogate) {
        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        } else {
          // valid surrogate pair
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      } else {
        // no lead yet

        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else {
          // valid lead
          leadSurrogate = codePoint
          continue
        }
      }
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":5,"ieee754":6,"is-array":7}],5:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],6:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],7:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}]},{},[1]);