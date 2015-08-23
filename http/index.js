///////////////
// Utilities //
///////////////

// Daisy-chainable HTMLElement maker
var fE = window.fE = Hematite.forgeElement;

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

var sidebar = window.sidebar = new Hematite.Sidebar();
sidebar.addButton({buttonName: 'land'    , faClass: 'fa-university', title: 'Landing page'       });
sidebar.addButton({buttonName: 'help'    , faClass: 'fa-question'  , title: 'Help'               });
sidebar.addButton({buttonName: 'fs'      , faClass: 'fa-arrows-alt', title: 'Fullscreen'         });
sidebar.addButton({buttonName: 'contrast', faClass: 'fa-adjust'    , title: 'Flip Contrast'      });
sidebar.addButton({buttonName: 'clear'   , faClass: 'fa-recycle'   , title: 'Clear local storage'});

var viewPanel = window.viewPanel = new Hematite.Panel({id: 'viewer', heading: 'First look into Nifleim\'s world'});
viewPanel.domElement.appendChild(canvas);
viewPanel.open();

var helpPanel = window.helpPanel = new Hematite.Panel({id: 'help', heading: 'A Panel That Could Be Helpful'});
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
    wstest.socket.send(Packets.toBuffer({type: Packets.TYPES.agent_action, regionID: 0, agentID: 1, action: 1, direction: direction}));
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
    
    fileReader.onload = function(e) {
      var bytes = new buffer.Buffer(new Uint8Array(fileReader.result));
      
      var packet = Packets.fromBuffer(bytes);
      
      switch(packet.type) {
        case Packets.TYPES.region_properties:
          break;
        case Packets.TYPES.cell_cache:
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
        case Packets.TYPES.agent_cache:
          cache.agents = packet.array;
          
          cache.agentsInitialized = true;
          
          if(cache.regionInitialized) {
            drawRegion();
          }
          
          break;
        case Packets.TYPES.cell_update:
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

eval(localStorage.onstart);

