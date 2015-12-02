/* globals buffer: false, Hematite: false, Packets: false, Particles: false, PersistentWS: false */

///////////////
// Utilities //
///////////////

// Daisy-chainable HTMLElement maker
var fE = window.fE = Hematite.forgeElement;

// Shim for vendor-prefixed fullscreen API
if(HTMLElement.prototype.requestFullscreen === undefined) {
  HTMLElement.prototype.requestFullscreen = HTMLElement.prototype.msRequestFullscreen || HTMLElement.prototype.mozRequestFullScreen || HTMLElement.prototype.webkitRequestFullscreen;
}
if(document.exitFullscreen === undefined) {
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

var sidebar = fE('ht-sidebar', {}, [
  fE('ht-instant', {id: 'help_button', faClass: 'fa-question'  , description: 'Help'               }),
  fE('ht-toggle' , {id: 'fs'         , faClass: 'fa-arrows-alt', description: 'Fullscreen'         , faClassAlt: 'fa-arrow-down'}),
  fE('ht-toggle' , {id: 'contrast'   , faClass: 'fa-adjust'    , description: 'Flip Contrast'      , faClassAlt: 'fa-circle-o'}),
  fE('ht-instant', {id: 'clear'      , faClass: 'fa-recycle'   , description: 'Clear local storage'}),
  fE('ht-select' , {action: 2, arg1: 0, textContent: '.'       , description: 'Morph terrain to grass'}),
  fE('ht-select' , {action: 2, arg1: 1, textContent: '~'       , description: 'Morph terrain to water'}),
  fE('ht-select' , {action: 2, arg1: 2, textContent: '#'       , description: 'Morph terrain to wall'})
]);
document.body.appendChild(sidebar);

var viewPanel = window.viewPanel = new Hematite.Panel({id: 'viewer', heading: 'First look into Nifleim\'s world'});
viewPanel.domElement.appendChild(canvas);
viewPanel.open();

var helpPanel = window.helpPanel = new Hematite.Panel({id: 'help', heading: 'A Panel That Could Be Helpful'});
helpPanel.domElement.appendChild(fE('div', {textContent: 'But this is only a demo'}));

var darkColors = window.darkColors = document.getElementById('dark_colors');

////////////
// Events //
////////////

document.querySelector('#help_button').addEventListener('click', function() {
  helpPanel.toggleOpen(true);
});

document.querySelector('#fs').addEventListener('click', function() {
  if(document.fullscreenElement === undefined) {
    document.body.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// Fullscreen button changes based on fullscreen events (still vendor-prefixed)
var fsHandler = function() {
  document.querySelector('#fs').state = (document.fullscreenElement !== undefined);
}
document.addEventListener("fullscreenchange", fsHandler);
document.addEventListener("webkitfullscreenchange", fsHandler);
document.addEventListener("mozfullscreenchange", fsHandler);
document.addEventListener("MSFullscreenChange", fsHandler);

document.querySelector('#contrast').addEventListener('click', function(e) {
  if(e.target.state) {
    document.head.removeChild(darkColors);
    localStorage.contrast = 'light';
  } else {
    document.head.appendChild(darkColors);
    localStorage.contrast = 'dark';
  }
});


document.querySelector('#clear').addEventListener('click', function() {
  localStorage.clear();
});

document.addEventListener('keydown', function(e) {
  var direction = [0, 69, 68, 67, 88, 90, 65, 81, 87].indexOf(e.keyCode);
  
  if(direction !== -1) {
    var action = sidebar.selection ? sidebar.selection.action : 1;
    var arg1 = sidebar.selection ? sidebar.selection.arg1 : 0;
    
    sidebar.selection = null;
    
    wstest.socket.send(Packets.toBuffer({type: Packets.TYPES.AGENT_ACTION, regionID: 0, agentID: 1, action: action, direction: direction, arg1: arg1}));
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
  var graphic = cell.hasAgent ? Particles.speciesLibrary[cache.agents[cell.agentID].speciesID] : Particles.terrainLibrary[cell.terrainID];
  
  ctx.hermesRedraw(graphic.char, 2 + 8*x, 2 + 12*y, 1, graphic.color);
}

var drawRegion = window.drawRegion = function() {
  cache.region.forEach(function(v, i) {
    v.forEach(function(w, j) {
      drawCell(i, j, w);
    });
  });
}

var wsMessageHandler = window.wsMessageHandler = function(e) {
  if(e.data.constructor.name === 'Blob') {
    var fileReader = new FileReader();
    
    fileReader.onload = function() {
      var bytes = new buffer.Buffer(new Uint8Array(fileReader.result));
      
      var packet = Packets.fromBuffer(bytes);
      
      switch(packet.type) {
        case Packets.TYPES.REGION_PROPERTIES:
          break;
        case Packets.TYPES.CELL_CACHE:
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
        case Packets.TYPES.AGENT_CACHE:
          cache.agents = packet.array;
          
          cache.agentsInitialized = true;
          
          if(cache.regionInitialized) {
            drawRegion();
          }
          
          break;
        case Packets.TYPES.CELL_UPDATE:
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

var wstest = window.wstest = new PersistentWS(window.location.protocol.replace('http', 'ws') + '//' + window.location.host, undefined, {verbose: true});

wstest.addEventListener('message', wsMessageHandler);
wstest.addEventListener('open', function() {
  wstest.socket.send(JSON.stringify({req: 'region-properties'}))
  wstest.socket.send(JSON.stringify({req: 'region-agents'}));
  wstest.socket.send(JSON.stringify({req: 'region'}))
});

/////////////////////
// Startup scripts //
/////////////////////

eval(localStorage.onstart); // jshint ignore:line
