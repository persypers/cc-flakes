/**
 * Abstract wrapper component for implementing kernel filtration: both canvas & webgl
 */
var DEFAULT_KERNEL_RADIUS = 3;
var WEBGL = (cc._renderType == cc.game.RENDER_TYPE_WEBGL);
var CANVAS = (cc._renderType == cc.game.RENDER_TYPE_CANVAS);

cc.Class({
    extends: cc.Component,

	editor : CC_EDITOR && {
		executeInEditMode : true
	},

	statics : {
		DEFAULT_KERNEL_RADIUS : DEFAULT_KERNEL_RADIUS
	},

    properties: {
		_kernelRadius : DEFAULT_KERNEL_RADIUS,
		kernelRadius : {
			type : 'Integer',
			get : function() {
				return this._kernelRadius;
			},
			set : function(value) {
				this._kernelRadius = value;
				if(! this.enabled) return;
				if(WEBGL) {
					this._updateShaderProgramGL(true);
				} else if(CANVAS) {
					this._redraw = true;
					this.node.setNodeDirty();
				}
			},
			tooltip : 'Sample rate that affects shader quality. Has a strongest impact on shader performance'
		},
		_radius : DEFAULT_KERNEL_RADIUS,
		radius : {
			type : 'Float',
			get : function() {
				return this._radius;
			},
			set : function(value) {
				if(this.enabled && Math.ceil(this._radius) != Math.ceil(value)) {
					this._radius = value;
					if(WEBGL) {
						this._updateShaderProgramGL(true);
					} else if(CANVAS) {
						this._redraw = true;
						this.node.setNodeDirty();
					}
				}
				this._radius = value;
			},
			tooltip : 'Radius of effect in pixels. Has no effect on shader performance'
		},
		
		_strength : {
			type : 'Float',
			default : 0
		},
		strength : {
			tooltip : 'Degree of filtration effect, no effect on shader performance, UB outside [0,1] range, somewhat similar to alpha-mixing the resulting image with normal one',
			get : function() {
				return this._strength;
			},
			set : function(value) {
				var mix = CANVAS && this._strength != value && this.enabled;
				this._strength = value;
				if(mix) {
					if(this._mixedSprite && !this._redraw) {
						this._mixFilteredCanvas();
					}
					this.node.setNodeDirty();
				}
			}
		},

		_paddingEnabled : false,
		_paddedShader : true,
		padding : {
			tooltip : 'Enables spriteFrame padding width of kernel radius to solve the problem of FX not being drawn outside of the original sprite bounds. Having padding in the sprite itself works better than this option. Medium impact on performance, should be disabled on post-screen effects',			
			get : function() {
				return this._paddingEnabled;
			},
			set : function(padding) {
				if(this._paddingEnabled == padding) {
					return;
				}
				this._paddingEnabled = padding;
				if(! this.enabled) return;
				if(WEBGL) {
					this._updateShaderProgramGL(true);
				} else if(CANVAS) {
					this._redraw = true;
					this.node.setNodeDirty();
				}
			}
		}
	},

	onDestroy : function() {
		if(CANVAS) {
			this._mixedTexture && this._mixedTexture.destroy();
			this._mixedSprite && this._mixedSprite.destroy();
		}
	},

	onEnable : function() {
		if(WEBGL) {
			this._updateShaderProgramGL(true);
		} else if(CANVAS) {
			this._updateShaderProgramCanvas(true);
		}
	},

	onDisable : function() {
		if(WEBGL) {
			this._updateShaderProgramGL(false);
		} else if(CANVAS) {
			this._updateShaderProgramCanvas(false);
		}
	},

/**
 * Enable or disable GL shader
 */
	_updateShaderProgramGL : function(enable) {
		var sgNode = this.getComponent(cc._SGComponent);
		sgNode = sgNode && sgNode._sgNode;
		var cmd = sgNode._renderCmd;
		if(!sgNode) {
			cc.warn('Shader component must be attached to a renderable node')
			return;
		}
		this._paddedShader = this._paddingEnabled && !(sgNode instanceof sp._SGSkeletonAnimation);
		if(sgNode.setPadding) {
			sgNode.setPadding(enable && this._paddingEnabled && Math.ceil(this._radius) || 0);
		}
		if(!enable) {
			cmd.setShaderProgram(cc.shaderCache.programForKey(cc.macro.SHADER_SPRITE_POSITION_TEXTURECOLOR));
			cmd.uploadData = Object.getPrototypeOf(cmd).uploadData;
			cmd.kernelShader = null;
			return;
		}
		var programName = this.shaderProgramName;
		var program = cc.shaderCache._programs[programName];
		if(!program) {
			program = this.compileShader && this.compileShader(this);
			cc.shaderCache.addProgram(program, programName);
		}
		if(!program) {
			console.error('Failed to create shader program for ', this.__classname__, programName);
			return;
		}
		if(program != cmd.getShaderProgram()) {
			this._program = program;
			this._uniWidthStep = program.getUniformLocationForName( "widthStep" );
			this._uniHeightStep = program.getUniformLocationForName( "heightStep" );
			this._uniRadius = program.getUniformLocationForName( "radius" );
			if(this._paddingEnabled) {
				this._uniSpriteBounds = program.getUniformLocationForName( "spriteBounds" );
			}
			this._uniStrength = program.getUniformLocationForName( "strength" );
			cmd.setShaderProgram(program);
			var shader = cmd.kernelShader = this;
			cmd.uploadData = function(f32buffer, ui32buffer, vertexDataOffset) {					
				if(this._node._uvsDirty) {
					var textureSize = this._node._spriteFrame._texture._contentSize;
					var rk = shader._radius / Math.max(0, shader._kernelRadius);
					shader._textureStepWidth = rk / textureSize.width;
					shader._textureStepHeight = rk / textureSize.height;
				}
				var program = this.getShaderProgram();
				program.use();
				shader._updateUniforms();
				program.updateUniforms();
				cc.renderer._breakBatch();
				var vertexCount = Object.getPrototypeOf(this).uploadData.call(this, f32buffer, ui32buffer, vertexDataOffset);
				return vertexCount;
			}
		}

		var spriteFrame = sgNode._spriteFrame;
		var texture = spriteFrame && spriteFrame.getTexture() || cmd.getTexture && cmd.getTexture();
		var textureSize = texture.getContentSize();
		var tw = 1.0 / textureSize.width, th = 1.0 / textureSize.height;
		var rk = this._radius / Math.max(0, this._kernelRadius);
		this._textureStepWidth = rk / textureSize.width;
		this._textureStepHeight = rk / textureSize.height;
		if(this._paddingEnabled && spriteFrame) {
			var frameRect = spriteFrame.getRect();
			var isRotated = spriteFrame.isRotated();
			this._spriteBounds = [
				frameRect.x * tw,
				frameRect.y * th,
				(frameRect.x + (isRotated && frameRect.height || frameRect.width) ) * tw,
				(frameRect.y + (isRotated && frameRect.width || frameRect.height)) * th
			];
		}
		cc.sh = this;
	},

/**
 * Enable or disable canvas shader
 */
	_updateShaderProgramCanvas : function(enable) {
		var sgNode = this.getComponent(cc._SGComponent);
		if(sgNode instanceof sp.Skeleton) {
			cc.warn("Canvas mode doesn't support spine");
			return;
		}
		sgNode = sgNode && sgNode._sgNode;
		this.node.setNodeDirty();
		var cmd = sgNode._renderCmd;
		if(!sgNode) {
			cc.warn('Shader component must be attached to a renderable node')
			return;
		}
		if(! enable) {
			var spriteFrame = this._inputSpriteFrame
			sgNode.setSpriteFrame(spriteFrame);
			sgNode.setContentSize(spriteFrame._rect);
			cmd.rendering = Object.getPrototypeOf(cmd).rendering;
			cmd.transform = Object.getPrototypeOf(cmd).transform;
			cmd._updateAnchorPointInPoint = Object.getPrototypeOf(cmd)._updateAnchorPointInPoint;
			return;
		}

		var shader = this;

		cmd.transform = function(parentCmd, recursive) {
			var sgNode = this._node;
			if(shader._redraw || sgNode._spriteFrame != shader._mixedSprite) {
				shader._initCanvas();
				sgNode.setSpriteFrame(shader._mixedSprite);
				sgNode.setContentSize(shader._mixedSprite._rect);
			}
			Object.getPrototypeOf(this).transform.call(this, parentCmd, recursive);
		}

		cmd.rendering = function(wrapper, scaleX, scaleY) {
			var sgNode = this._node;
			if(shader._redraw) {
				shader._redraw = false;
				shader._updateFilteredCanvas();
			}
			Object.getPrototypeOf(this).rendering.call(this, wrapper, scaleX, scaleY);
		}
	
	/**
	 * Anchor works wrong with padded sprite and we can't just set original sprite's content size because of dirty region opt.
	 */
		cmd._updateAnchorPointInPoint = function() {
			var r = shader.padding && Math.ceil(shader._radius) || 0;
			var locAPP = this._anchorPointInPoints, locSize = this._node._contentSize, locAnchorPoint = this._node._anchorPoint;
			locAPP.x = (locSize.width - 2 * r) * locAnchorPoint.x + r;
			locAPP.y = (locSize.height - 2 * r) * locAnchorPoint.y + r;
			this.setDirtyFlag(_ccsg.Node._dirtyFlags.transformDirty);
		}

		this.node.setNodeDirty();
		this._redraw = true;

		cc.sh = this;
		cc.cmd = cmd;
	},

/*******
 * Canvas helper methods
 *******/

/**
 * Create internal canvas for current required sprite & padding
 */
	_initCanvas : function(spriteFrame) {
		spriteFrame = spriteFrame || this.getComponent(cc._SGComponent).spriteFrame;
		var rect = spriteFrame.getRect();
		var padding = this.padding && Math.ceil(this._radius);
		var w = rect.width + padding * 2;
		var h = rect.height + padding * 2;
		if(this._mixedTexture) {
			if( (w == this._mixedTexture.width) && (h == this._mixedTexture.height) ) {
				return;		// sizes match, so no need to create canvases anew
			}
			this._mixedSprite.destroy();
			this._mixedTexture.destroy(); 
		}

		var canvas = this._filteredCanvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;

		canvas = this._mixedCanvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		this._mixedTexture = new cc.Texture2D();
		this._mixedTexture.initWithElement(canvas);
		this._mixedSprite = new cc.SpriteFrame(this._mixedTexture);
	},

/**
 * Render fully blurred sprite for canvas mode
 */
	_updateFilteredCanvas : function(spriteFrame) {
		this._inputSpriteFrame = spriteFrame = spriteFrame || this.getComponent(cc._SGComponent).spriteFrame;
		this._initCanvas(spriteFrame);

		var img = spriteFrame.getTexture().getHtmlElementObj();
		var rect = spriteFrame.getRect();

		var ctx = this._filteredCanvas.getContext('2d');
		ctx.clearRect(0, 0, this._filteredCanvas.width, this._filteredCanvas.height);
		this.drawFilteredCanvas(ctx, img, rect);
		this._mixFilteredCanvas(spriteFrame);
	},

/**
 * When strength property changes (or upon init) we mix fully blurred image with normal image with <strength> parameter
 */
	_mixFilteredCanvas : function(spriteFrame) {
		if(!this._filteredCanvas) {
			this._updateFilteredCanvas();
			return;
		}
		spriteFrame = spriteFrame || this._inputSpriteFrame;
		var img = spriteFrame.getTexture().getHtmlElementObj();
		var rect = spriteFrame.getRect();

		var padding = this.padding && Math.ceil(this._radius);
		
		var canvas = this._mixedCanvas;
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		this.mixFilteredCanvas(ctx, this._filteredCanvas, img, rect);
		this.node.setNodeDirty();
	},

/***********************************
 * Methods that are supposed to be
 * reimplemented by derived component
 **********************************/

/**
 * Upload data required for rendering to GPU
 */
	_updateUniforms : function() {
		this._program.setUniformLocationWith1f( this._uniWidthStep, this._textureStepWidth );
		this._program.setUniformLocationWith1f( this._uniHeightStep, this._textureStepHeight );
		this._program.setUniformLocationWith1f( this._uniStrength, this._strength );
		this._program.setUniformLocationWith1f( this._uniRadius, this._radius );
		if(this._paddedShader) {
			var loc = this._spriteBounds;
			this._program.setUniformLocationWith4f( this._uniSpriteBounds, loc[0], loc[1], loc[2], loc[3]);
		}
	},

/**
 * Draw a canvas with fully filtered sprite
 */
	drawFilteredCanvas : function(targetContext, srcImage, srcRect) {
		var padding = this.padding && Math.ceil(this._radius);
		targetContext.globalCompositeOperation = 'lighter';
		targetContext.globalAlpha = 1 / Math.pow(this.kernelRadius * 2 + 1, 2);

		var texStep = this._radius / this._kernelRadius;
	// doing what fragment shader does in WebGL
		for(var x = -this.kernelRadius; x <= this.kernelRadius; x++) {
			for(var y = -this.kernelRadius; y <= this.kernelRadius; y++) {
				targetContext.drawImage(srcImage, 
					srcRect.x, srcRect.y, srcRect.width, srcRect.height,
					x * texStep + padding, y * texStep + padding, srcRect.width, srcRect.height
				);			
			}
		}
	},

/**
 * Mix filtered canvas with given parameters (e.g. color for outline)
 */
	mixFilteredCanvas : function(targetContext, filteredCanvas, srcImage, srcRect) {
		targetContext.globalCompositeOperation = 'lighter';
		targetContext.globalAlpha = 1 - this.strength;
		targetContext.drawImage(srcImage, srcRect.x, srcRect.y, srcRect.width, srcRect.height, padding, padding, srcRect.width, srcRect.height);
		targetContext.globalAlpha = this.strength;
		targetContext.drawImage(filteredCanvas, 0, 0);
	}

});
