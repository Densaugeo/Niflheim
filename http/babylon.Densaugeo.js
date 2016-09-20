/**
 * Dependencies: babylon.js
 */

if(window.BABYLON == null) {
  console.error('babylon.Densaugeo.js depends on BABYLON.js');
}

BABYLON.Densaugeo = {}

// BABYLON.Matrix manipulators. Most of these used to be in THREE, but were removed
// (probably to reduce file size)
BABYLON.Matrix.prototype.translateX = function(x) {var a = this.m; a[12] += a[0]*x; a[13] += a[1]*x; a[14] += a[ 2]*x; return this}
BABYLON.Matrix.prototype.translateY = function(y) {var a = this.m; a[12] += a[4]*y; a[13] += a[5]*y; a[14] += a[ 6]*y; return this}
BABYLON.Matrix.prototype.translateZ = function(z) {var a = this.m; a[12] += a[8]*z; a[13] += a[9]*z; a[14] += a[10]*z; return this}

BABYLON.Matrix.prototype.premultiply = function(matrix) {
  var a = matrix.m, b = [], r = this.m;
  
  r.forEach(function(v, i) {
    b[i] = v;
  });
  
  multiply4x4(a, b, r);
}

BABYLON.Matrix.prototype.postmultiply = function(matrix) {
  var a = [], b = matrix.m, r = this.m;
  
  r.forEach(function(v, i) {
    a[i] = v;
  });
  
  multiply4x4(a, b, r);
}

var multiply4x4 = function(a, b, r) {
  for(var i = 0; i < 4; ++i) {
    for(var k = 0; k < 4; ++k) {
      r[i + 4*k] = a[i]*b[4*k] + a[i + 4]*b[1 + 4*k] + a[i + 8]*b[2 + 4*k] + a[i + 12]*b[3 + 4*k];
    }
  }
}

// panKeySpeed           - Units/ms
// panMouseSpeed         - Units/px
// rotationKeySpeed      - Radians/ms
// rotationMouseSpeed    - Radians/px
// rotationAccelSpeed    - Radians/radian
// dollySpeed            - Units/click
// touchThrottleSpeed    - Units/ms per px displaced
// joystickPanSpeed      - Units/ms per fraction displaced
// joystickRotSpeed      - Radians/ms per fraction displaced
// joystickThrottleSpeed - Units/ms per fraction displaced

BABYLON.Densaugeo.FlyingCamera = function(name, transform, scene, domElement, options) {
  BABYLON.Camera.call(this, name, BABYLON.Vector3.Zero(), scene);
  
  this._viewMatrix = new BABYLON.Matrix();
  this.transform = transform;
  this.transform.invertToRef(this._viewMatrix);
  
  // Redirect .upVector + its cache to .transform, so that changes to .transform trigger updates
  this._cache.upVector = BABYLON.Matrix.Identity();
  this.upVector = this.transform;
  
  // Bind .position to .transform
  Object.defineProperties(this.position, {
    x: {
      enumerable: true,
      get: () => this.transform.m[12],
      set: v => this.transform.m[12] = v
    },
    y: {
      enumerable: true,
      get: () => this.transform.m[13],
      set: v => this.transform.m[13] = v
    },
    z: {
      enumerable: true,
      get: () => this.transform.m[14],
      set: v => this.transform.m[14] = v
    }
  });
  
  var self = this;
  
  if(domElement == null) {
    throw new TypeError('Error in THREE.Densaugeo.FreeControls constructor: domElement must be supplied');
  }
  
  for(var i in options) {
    this[i] = options[i];
  }
  
  var inputs = {}; // This particular ; really is necessary
  
  document.addEventListener('keydown', function(e) {
    if(!e.altKey && !e.ctrlKey && !e.shiftKey) {
      inputs[e.keyCode] = true;
    }
  });
  
  document.addEventListener('keyup', function(e) {
    delete inputs[e.keyCode];
  });
  
  // FF doesn't support standard mousewheel event
  document.addEventListener('mousewheel', function(e) {
    self.transform.translateZ(e.wheelDelta*self.dollySpeed/360);
  });
  document.addEventListener('DOMMouseScroll', function(e) {
    self.transform.translateZ(-e.detail*self.dollySpeed/3);
  });
  
  // Context menu interferes with mouse control
  domElement.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // Only load mousemove handler while mouse is depressed
  domElement.addEventListener('mousedown', function(e) {
    if(e.shiftKey) {
      var requestPointerLock = domElement.requestPointerLock || domElement.mozRequestPointerLock || domElement.webkitRequestPointerLock;
      requestPointerLock.call(domElement);
    } else if(e.which === 1) {
      domElement.addEventListener('mousemove', mousePanHandler);
    } else if(e.which === 3) {
      domElement.addEventListener('mousemove', mouseRotHandler);
    }
  });
  
  domElement.addEventListener('mouseup', function() {
    domElement.removeEventListener('mousemove', mousePanHandler);
    domElement.removeEventListener('mousemove', mouseRotHandler);
  });
  
  domElement.addEventListener('mouseleave', function() {
    domElement.removeEventListener('mousemove', mousePanHandler);
    domElement.removeEventListener('mousemove', mouseRotHandler);
  });
  
  var pointerLockHandler = function(e) {
    var pointerLockElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
    
    if(pointerLockElement === domElement) {
      document.addEventListener('mousemove', mouseRotHandler);
    } else {
      document.removeEventListener('mousemove', mouseRotHandler);
    }
  }
  
  document.addEventListener('pointerlockchange'      , pointerLockHandler);
  document.addEventListener('mozpointerlockchange'   , pointerLockHandler);
  document.addEventListener('webkitpointerlockchange', pointerLockHandler);
  
  var mousePanHandler = function(e) {
    translateX += (e.movementX || e.mozMovementX || e.webkitMovementX || 0)*self.panMouseSpeed;
    translateY -= (e.movementY || e.mozMovementY || e.webkitMovementY || 0)*self.panMouseSpeed;
  }
  
  var mouseRotHandler = function(e) {
    rotateGlobalZ -= (e.movementX || e.mozMovementX || e.webkitMovementX || 0)*self.rotationMouseSpeed;
    rotateX       -= (e.movementY || e.mozMovementY || e.webkitMovementY || 0)*self.rotationMouseSpeed;
  }
  
  // Touchmove events do not work when directly added, they have to be added by a touchstart listener
  // I think this has to do with the default touch action being scrolling
  domElement.addEventListener('touchstart', function(e) {
    e.preventDefault();
    
    if(e.touches.length === 1) {
      accelActive = true;
      
      var rect = domElement.getBoundingClientRect();
      var lateralFraction = (e.touches[0].clientX - rect.left)/rect.width;
      
      if(lateralFraction < 0.9) {
        touchZeroPrevious = e.touches[0];
        domElement.addEventListener('touchmove', TouchHandler);
      } else {
        throttleZero = e.touches[0].clientY;
        domElement.addEventListener('touchmove', touchThrottleHandler);
      }
    } else if(e.touches.length === 2) {
      touchOnePrevious = e.touches[1];
    }
  });
  
  domElement.addEventListener('touchend', function(e) {
    if(e.touches.length === 0) {
      domElement.removeEventListener('touchmove', TouchHandler);
      domElement.removeEventListener('touchmove', touchThrottleHandler);
      touchThrottle = rotationRateAlpha = rotationRateBeta = rotationRateGamma = 0;
      accelActive = false;
    }
  });
  
  var TouchHandler = function(e) {
    e.preventDefault(); // Should be called at least on every touchmove event
    
    translateX += (e.touches[0].clientX - touchZeroPrevious.clientX)*self.panTouchSpeed;
    translateY -= (e.touches[0].clientY - touchZeroPrevious.clientY)*self.panTouchSpeed;
    
    touchZeroPrevious = e.touches[0];
    
    if(e.touches.length === 2) {
      rotateX       -= (e.touches[1].clientY - touchOnePrevious.clientY)*self.rotatationTouchSpeed;
      rotateGlobalZ -= (e.touches[1].clientX - touchOnePrevious.clientX)*self.rotatationTouchSpeed;
      
      touchOnePrevious = e.touches[1];
    }
  }
  
  var touchThrottleHandler = function(e) {
    e.preventDefault(); // Should be called at least on every touchmove event
    
    touchThrottle = (e.touches[0].clientY - throttleZero)*self.touchThrottleSpeed;
    
    if(e.touches.length === 2) {
      translateX += (e.touches[1].clientX - touchOnePrevious.clientX)*self.panTouchSpeed;
      translateY -= (e.touches[1].clientY - touchOnePrevious.clientY)*self.panTouchSpeed;
      
      touchOnePrevious = e.touches[1];
    }
  }
  
  var rotationRateConversion = 0.000017453292519943296;
  
  // Browser detection shim for Chome, since they use different units for DeviceRotationRate without
  // providing any documentation or other way of detecting what units are being used
  if(window.chrome) {
    rotationRateConversion = 0.001;
  }
  
  var accelHandler = function(e) {
    if(accelActive) {
      // Constant = Math.PI/180/1000
      rotationRateAlpha = e.rotationRate.alpha*rotationRateConversion*self.rotationAccelSpeed;
      rotationRateBeta  = e.rotationRate.beta *rotationRateConversion*self.rotationAccelSpeed;
      rotationRateGamma = e.rotationRate.gamma*rotationRateConversion*self.rotationAccelSpeed;
    }
  }
  
  // Attach devicemotion listener on startup because attaching it during a touchstart event is horribly buggy in FF
  window.addEventListener('devicemotion', accelHandler);
  
  var gamepads = [];
  
  window.addEventListener('gamepadconnected', function(e) {
    gamepads.push(e.gamepad.index);
  });
  
  window.addEventListener('gamepaddisconnected', function(e) {
    if(gamepads.indexOf(e.gamepad) > -1) {
      gamepads.splice(gamepads.indexOf(e.gamepad), 1);
    }
  });
  
  var touchZeroPrevious;
  var touchOnePrevious;
  var throttleZero, touchThrottle = 0;
  var rotationRateAlpha = 0, rotationRateBeta = 0, rotationRateGamma = 0, accelActive = false;
  
  var timePrevious = Date.now();
  var time = 0;
  
  // Working variables for camLoop
  var translateX = 0, translateY = 0, translateZ = 0, translateGlobalZ = 0;
  var rotateX = 0, rotateY = 0, rotateZ = 0, rotateGlobalZ = 0, gp, axes;
  
  var camLoop = function() {
    time = Date.now() - timePrevious;
    timePrevious += time;
    
    if(inputs[self.keyStrafeLeft ]) translateX       -= time*self.panKeySpeed;
    if(inputs[self.keyStrafeRight]) translateX       += time*self.panKeySpeed;
    if(inputs[self.keyForward    ]) translateZ       -= time*self.panKeySpeed;
    if(inputs[self.keyBackward   ]) translateZ       += time*self.panKeySpeed;
    if(inputs[self.keyStrafeUp   ]) translateGlobalZ += time*self.panKeySpeed;
    if(inputs[self.keyStrafeDown ]) translateGlobalZ -= time*self.panKeySpeed;
    if(inputs[self.keyTurnUp     ]) rotateX          += time*self.rotationKeySpeed;
    if(inputs[self.keyTurnDown   ]) rotateX          -= time*self.rotationKeySpeed;
    if(inputs[self.keyTurnLeft   ]) rotateGlobalZ    += time*self.rotationKeySpeed;
    if(inputs[self.keyTurnRight  ]) rotateGlobalZ    -= time*self.rotationKeySpeed;
    
    for(var i = 0, endi = gamepads.length; i < endi; ++i) {
      gp = navigator.getGamepads()[i];
      axes = gp.axes;
      
      if(gp.mapping === '') {
        if(Math.abs(axes[0]) > 0.05) translateX    += axes[0]*time*self.joystickPanSpeed;
        if(Math.abs(axes[1]) > 0.05) translateY    -= axes[1]*time*self.joystickPanSpeed;
        if(Math.abs(axes[3]) > 0.05) rotateGlobalZ -= axes[3]*time*self.joystickRotSpeed;
        if(Math.abs(axes[4]) > 0.05) rotateX       -= axes[4]*time*self.joystickRotSpeed;
        
        if(axes[2] > -0.95 || axes[5] > -0.95) translateZ -= (axes[5] - axes[2])*time*self.joystickThrottleSpeed/2;
      } else if(gp.mapping = 'standard') {
        if(Math.abs(axes[0]) > 0.05) translateX    += axes[0]*time*self.joystickPanSpeed;
        if(Math.abs(axes[1]) > 0.05) translateY    -= axes[1]*time*self.joystickPanSpeed;
        if(Math.abs(axes[2]) > 0.05) rotateGlobalZ -= axes[2]*time*self.joystickRotSpeed;
        if(Math.abs(axes[3]) > 0.05) rotateX       -= axes[3]*time*self.joystickRotSpeed;
        
        if(gp.buttons[6].value > 0.025 || gp.buttons[7].value > 0.025) translateZ -= (gp.buttons[7].value - gp.buttons[6].value)*time*self.joystickThrottleSpeed;
      }
    }
    
    if(translateX) {
      self.transform.translateX(translateX);
    }
    
    if(translateY) {
      self.transform.translateY(translateY);
    }
    
    if(translateZ || touchThrottle) {
      self.transform.translateZ(-translateZ - time*touchThrottle);
    }
    
    if(translateGlobalZ) {
      self.transform.m[14] += translateGlobalZ;
    }
    
    if(rotateX || rotationRateBeta) {
      self.transform.postmultiply(BABYLON.Matrix.RotationX(-rotateX + time*rotationRateBeta));
    }
    
    if(rotateY || rotationRateAlpha) {
      self.transform.postmultiply(BABYLON.Matrix.RotationY(-rotateY - time*rotationRateAlpha));
    }
    
    if(rotateZ || rotationRateGamma) {
      self.transform.postmultiply(BABYLON.Matrix.RotationZ(-rotateZ + time*rotationRateGamma));
    }
    
    if(rotateGlobalZ) {
      var position = self.transform.getTranslation();
      self.transform.premultiply(BABYLON.Matrix.RotationZ(-rotateGlobalZ));
      self.transform.setTranslation(position);
    }
    
    requestAnimationFrame(camLoop);
    
    translateX = translateY = translateZ = translateGlobalZ = rotateX = rotateY = rotateZ = rotateGlobalZ = 0;
  }
  
  camLoop();
}

BABYLON.Densaugeo.FlyingCamera.prototype = Object.create(BABYLON.Camera.prototype);
BABYLON.Densaugeo.FlyingCamera.prototype.constructor = BABYLON.Densaugeo.FlyingCamera;

// ._viewMatrix now comes from .transform
BABYLON.Densaugeo.FlyingCamera.prototype._getViewMatrix = function() {
  this.transform.invertToRef(this._viewMatrix);
  
  return this._viewMatrix;
}

with({p: BABYLON.Densaugeo.FlyingCamera.prototype}) {
  p.panKeySpeed = 0.01;
  p.rotationKeySpeed = 0.001;
  p.panMouseSpeed = 0.1;
  p.rotationMouseSpeed = 0.002;
  p.panTouchSpeed = 0.1;
  p.rotatationTouchSpeed = 0.002;
  p.rotationAccelSpeed = 1;
  p.dollySpeed = 1;
  p.touchThrottleSpeed = 0.0005;
  p.joystickPanSpeed = 0.05;
  p.joystickRotSpeed = 0.003;
  p.joystickThrottleSpeed = 0.025;
  p.keyTurnLeft = 37; // Left arrow
  p.keyTurnRight = 39; // Right arrow
  p.keyTurnUp = 38; // Up arrow
  p.keyTurnDown = 40; // Down arrow
  p.keyStrafeLeft = 65; // A
  p.keyStrafeRight = 68; // D
  p.keyStrafeUp = 69; // E
  p.keyStrafeDown = 67; // C
  p.keyForward = 87; // W
  p.keyBackward = 83; // S
}
