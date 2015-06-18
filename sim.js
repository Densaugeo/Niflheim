process.title = 'sim';

var repl    = require('repl');
var fs      = require('fs');
var moment  = require('moment');
var Particles = require('./Particles.js');

//////////////
// Settings //
//////////////

var options;

try {
  options = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
} catch(e) {
  console.log('Warning: Unable to read config file "' + __dirname + '/config.json". (' + e + ')');
  console.log('Attempting to use "' + __dirname + '/default_config.json"...');
  
  try {
    options = JSON.parse(fs.readFileSync(__dirname + '/default_config.json'));
  } catch(f) {
    console.log('Error: Unable to read config file "' + __dirname + '/default-config.json". (' + f + ')');
    process.exit(1);
  }
}

// Logger - Prints to stdout with timestamp, unless silenced by option
var log = options.silent ? function(){} : function(message){console.log(moment.utc(Date.now()).format('YYMMDD/HHmmss.SSS') + ', ' + message)};

////////////////////////////
// World contruction area //
////////////////////////////

var Region = function Region(options) {
  var startTime = Date.now();
  
  // @prop Number width -- Width of Region in Cells (10 bits)
  this.width = (options.width & 0x3FF) >>> 0;
  
  // @prop Number height -- Height of Region in Cells (10 bits)
  this.height = (options.height & 0x3FF) >>> 0;
  
  log('Beginning construction of Region with width ' + this.width + ' and height ' + this.height);
  
  for(var i = 0, endi = this.width; i < endi; ++i) {
    this[i] = new Array(this.height);
    
    for(var j = 0, endj = this.height; j < endj; ++j) {
      this[i][j] = new Particles.Cell({x: i, y: j, terrain: Particles.terrainLibrary[0]});
    }
  }
  
  log('Region created in ' + (Date.now() - startTime) + ' ms');
}
Region.prototype = Object.create(Array.prototype);
Region.prototype.constructor = Region;

Region.prototype.spawn = function(args) {
  if(!(args.agent instanceof Particles.NPC)) {
    throw new TypeError('Error at Region.prototype.spawn(): args.agent must be an NPC');
  }
  
  if(args.agent.cell !== undefined) {
    throw new Error('Error at Region.prototype.spawn(): args.agent already has a .cell');
  }
  
  var targetCell = args.cell || this[args.x][args.y];
  
  if(!(targetCell instanceof Particles.Cell)) {
    throw new TypeError('Error at Region.prototype.spawn(): args.cell must be a Cell, or args.x and args.y must be valid Cell coordinates');
  }
  
  if(targetCell.pauli() || targetCell.agent !== undefined) {
    return false;
  }
  
  targetCell.agent = args.agent;
  args.agent.cell = targetCell;
  
  log('NPC (species: ' + args.agent.species.name + ') spawned at <' + targetCell.x + ', ' + targetCell.y + '>');
  
  return true;
}

// Instantiate Region (filled with grass)
var aRegion = new Region({width: 12, height: 12});

// Instantiate NPCs
var someAgents = [
  new Particles.NPC({species: Particles.speciesLibrary[0], agentID: 0})
]

// Spawn NPCs
aRegion.spawn({agent: someAgents[0], x: 0, y: 0});

// Stream updates
var zmq = require('zmq');
var updater = zmq.socket('pub');

updater.bindSync('tcp://127.0.0.1:3000');
log('Publisher bound to port 3000');

var cacheSender = zmq.socket('rep');

cacheSender.bindSync('tcp://127.0.0.1:3001');
log('Responder bound to port 3001');

cacheSender.on('message', function(message) {
  if(message.toString() === 'region') {
    var buf = Buffer(13*aRegion.width*aRegion.height);
    
    for(var i = 0, endi = aRegion.width; i < endi; ++i) {
      for(var j = 0, endj = aRegion.height; j < endj; ++j) {
        aRegion[i][j].toBuffer().copy(buf, 13*(j + i*aRegion.height));
      }
    }
    
    cacheSender.send(buf);
  }
  
  if(message.toString() === 'region-agents') {
    var buf = Buffer(8*someAgents.length);
    
    for(var i = 0, endi = someAgents.length; i < endi; ++i) {
      someAgents[i].toBuffer().copy(buf, 8*i);
    }
    
    cacheSender.send(buf);
  }
});

var notificationQueue = [];

// Main sim loop
setInterval(function() {
  // AI phase
  someAgents.forEach(function(v, i, a) {
    v.move = Math.floor(9*Math.random());
  });
  
  // Movement phase
  someAgents.forEach(function(v, i, a) {
    if(v.move === 0) {
      return;
    }
    
    var moveX = [0, 1, 1, 1, 0, -1, -1, -1, 0];
    var moveY = [0, -1, 0, 1, 1, 1, 0, -1, -1];
    
    var targetCell = aRegion[v.cell.x + moveX[v.move]] && aRegion[v.cell.x + moveX[v.move]][v.cell.y + moveY[v.move]];
    
    if(targetCell && !targetCell.pauli()) {
      notificationQueue.push(v.cell);
      notificationQueue.push(targetCell);
      
      targetCell.agent = v;
      v.cell.agent = undefined;
      v.cell = targetCell;
    }
  });
  
  // Notification phase
  notificationQueue.forEach(function(v, i, a) {
    // Send a notification
    updater.send(['cell', v.toBuffer()]);
  });
  notificationQueue = [];
}, 1000);

//////////
// REPL //
//////////

if(options.repl) {
  var cli = repl.start({});
  
  cli.context.repl               = repl;
  cli.context.fs                 = fs;
  cli.context.moment             = moment;
  cli.context.zmq             = zmq;
  
  cli.context.options            = options;
  cli.context.log                = log;
  cli.context.cli                = cli;
  
  // World construction stuff
  cli.context.Particles  = Particles;
  cli.context.Region  = Region;
  cli.context.aRegion = aRegion;
  cli.context.someAgents = someAgents;
}
