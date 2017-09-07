var KernelShader = require('KernelShader');

/**
 * Init shader for webgl mode
 */
var compileShader = function(shader) {
	// TODO : implement an actual gaussian blur
	var fragShader = `
			#ifdef GL_ES
			precision mediump float;
			#endif
			varying vec2 v_texCoord;
			varying vec4 v_fragmentColor;
			uniform float widthStep;
			uniform float heightStep;
			uniform float strength;
			uniform float radius;
			uniform vec4 outlineColor;
			const float blurRadius = ` + Math.floor(shader.kernelRadius) +`.0;
			
			` + (shader._paddedShader &&
		// discard texture data outside of given spriteFrame for padded shaders:
			`uniform vec4 spriteBounds;
			float testSpriteBounds(const vec2 tex)
			{
				return step(spriteBounds.x, tex.x) * step(spriteBounds.y, tex.y) * step(tex.x, spriteBounds.z) * step(tex.y, spriteBounds.w);
			}`
			|| '') + `

			void main()
			{
				vec4 texColor = texture2D(CC_Texture0, v_texCoord);
				` + (shader._paddedShader && 'texColor *= testSpriteBounds(v_texCoord);' || '') + `
				vec4 dstColor = vec4(0.0, 0.0, 0.0, 0.0);

				float outlineAlpha = 0.0;		
				for(float fy = -blurRadius; fy <= blurRadius; ++fy)
				{
					for(float fx = -blurRadius; fx <= blurRadius; ++fx)
					{
						vec2 coord = vec2(fx * widthStep, fy * heightStep) + v_texCoord;
						vec4 sample = texture2D(CC_Texture0, coord);
						` + (shader._paddedShader && 'sample *= testSpriteBounds(coord);' || '') + `
						outlineAlpha += sample.a;
 					}
				}				
				float dist = outlineAlpha / ( (blurRadius * 2.0 + 1.0) * (blurRadius * 2.0 + 1.0));
				outlineAlpha *= strength;
				float treshold = blurRadius * 2.0;
				outlineAlpha = clamp((outlineAlpha - treshold) / treshold, 0.0, 1.0); 
			` + (cc.macro.AUTO_PREMULTIPLIED_ALPHA_FOR_PNG && 
				'gl_FragColor = (outlineColor * outlineAlpha * (1.0 - texColor.a) + texColor) * v_fragmentColor;'
			|| 
				'gl_FragColor = mix(outlineColor * outlineAlpha, texColor, texColor.a) * v_fragmentColor;') + `
				//gl_FragColor = vec4(0.3, 0.7, 0.2, 0.5);
			}`;

	var program = new cc.GLProgram();
	program.initWithVertexShaderByteArray(cc.PresetShaders.SPRITE_POSITION_TEXTURE_COLOR_VERT, fragShader);
	program.addAttribute(cc.macro.ATTRIBUTE_NAME_POSITION, cc.macro.VERTEX_ATTRIB_POSITION);
	program.addAttribute(cc.macro.ATTRIBUTE_NAME_COLOR, cc.macro.VERTEX_ATTRIB_COLOR);
	program.addAttribute(cc.macro.ATTRIBUTE_NAME_TEX_COORD, cc.macro.VERTEX_ATTRIB_TEX_COORDS);
	program.link();
	program.updateUniforms();
	return program;
}

var rev255 = 1 / 255;

var _prepareColorGL = function(color, array) {
	array = array || [];
	var alpha = array[3] = color.a * rev255;
	var mult = (rev255 * alpha);
	array[0] = color.r * mult;
	array[1] = color.g * mult;
	array[2] = color.b * mult;
}

cc.Class({
    extends: KernelShader,
	
	properties : {
		shaderProgramName : {
			get : function() {
				return 'ShaderSpriteOutline' + (this._paddedShader && 'PaddedR' || 'R' ) + Math.floor(this.kernelRadius);
			},
			visible : false
		},

		_color : ['Float'],

		_outlineColor : cc.Color.WHITE,
		outlineColor : {
			get : function() {
				return this._outlineColor;
			},
			set : function(value) {
				this._outlineColor = value;
				if(cc._renderType == cc.game.RENDER_TYPE_WEBGL) {
					this._color = this._color || [];
					_prepareColorGL(value, this._color);
				} else if(cc._renderType == cc.game.RENDER_TYPE_CANVAS) {
					this._redraw = true;
					this.node.setNodeDirty();
				}
			}
		},

		strength : {
			tooltip : 'Degree of filtration effect',
			override : true,
			get : function() {
				return this._strength;
			},
			set : function(value) {
				var mix = (cc._renderType == cc.game.RENDER_TYPE_CANVAS) && this._strength != value && this.enabled;
				this._strength = value;
				if(mix) {
					this._redraw = true;
					this.node.setNodeDirty();
				}
			}
		}
	},

	compileShader : compileShader,

	_updateShaderProgramGL : function(enabled) {
		KernelShader.prototype._updateShaderProgramGL.call(this, enabled);
		this._uniOutlineColor = this._program.getUniformLocationForName('outlineColor');
		this._color = this._color || [];
		_prepareColorGL(this._outlineColor, this._color);
	},

	_updateUniforms : function() {
		KernelShader.prototype._updateUniforms.call(this);
		var loc = this._color;
		this._program.setUniformLocationWith4f( this._uniOutlineColor, loc[0], loc[1], loc[2], loc[3]);
	},

	drawFilteredCanvas : function(targetContext, srcImage, srcRect) {
		var padding = this.padding && Math.ceil(this._radius) || 0;
		//targetContext.globalCompositeOperation = 'source-over';
		targetContext.globalCompositeOperation = 'lighten';
		targetContext.globalAlpha = 1 / this.kernelRadius * 2;
		//targetContext.globalAlpha = 1 / Math.pow(this.kernelRadius * 2 + 1, 2);
	// doing what fragment shader does in WebGL
		var r = this.kernelRadius;
		var texStep = this._radius / this._kernelRadius;
		for(var x = -r; x <= r; x++) {
			for(var y = -r; y <= r; y++) {
				var tx = x * texStep;
				var ty = y * texStep;
				targetContext.globalAlpha = this.strength / (x * x + y * y);
				targetContext.drawImage(srcImage, 
					srcRect.x, srcRect.y, srcRect.width, srcRect.height,
					tx + padding, ty + padding, srcRect.width, srcRect.height
				);			
			}
		}
	},

	mixFilteredCanvas : function(targetContext, filteredCanvas, srcImage, srcRect) {
		var padding = this.padding && Math.ceil(this._radius);
		//targetContext.globalCompositeOperation = 'lighter';
		targetContext.drawImage(filteredCanvas, 0, 0);

		targetContext.globalCompositeOperation = 'source-in';
		targetContext.fillStyle = this._outlineColor.toCSS('#rrggbb');
		targetContext.globalAlpha = this._outlineColor.a * rev255;
		targetContext.fillRect(0, 0, targetContext.canvas.width, targetContext.canvas.height);
		
		targetContext.globalAlpha = 1;
		targetContext.globalCompositeOperation = 'source-over';
		targetContext.drawImage(srcImage, srcRect.x, srcRect.y, srcRect.width, srcRect.height, padding, padding, srcRect.width, srcRect.height);
		//targetContext.globalAlpha = this.strength;
		
	},

	onLoad : function() {
		this.strengthInner = this.strength;
	},

	fadeIn : function() {
		if(this.curFadeTimer) clearTimeout(this.curFadeTimer);
		var speed = 0.04;
		var delay = 16;
		this.strength = 0;
		this.enabled = true;
		this._fadeIn(speed, delay);
	},

	_fadeIn : function(speed, delay) {
		if(this.strength < this.strengthInner) {
			this.strength += speed;
			this.curFadeTimer = setTimeout(this._fadeIn.bind(this, speed, delay), delay);
		} else {
			this.curFadeTimer = null;
			this.strength = this.strengthInner;
		}
	},

	fadeOut : function() {
		if(this.curFadeTimer) clearTimeout(this.curFadeTimer);
		var speed = 0.04;
		var delay = 16;
		this._fadeOut(speed, delay);

	},

	_fadeOut : function(speed, delay) {
		if(this.strength > 0) {
			this.strength -= speed;
			this.curFadeTimer = setTimeout(this._fadeOut.bind(this, speed, delay), delay);
		} else {
			this.curFadeTimer = null;
			this.strength = 0;
			this.enabled = false;
		}
	}
});