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
			const float blurRadius = ` + Math.floor(shader._kernelRadius) +`.0;
			const float blurPixels = (blurRadius * 2.0 + 1.0) * (blurRadius * 2.0 + 1.0);
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

				vec4 blurColor = vec4(0.0, 0.0, 0.0, 0.0);				
				for(float fy = -blurRadius; fy <= blurRadius; ++fy)
				{
					for(float fx = -blurRadius; fx <= blurRadius; ++fx)
					{
						vec2 coord = vec2(fx * widthStep, fy * heightStep) + v_texCoord;
						vec4 sample = texture2D(CC_Texture0, coord);  
						` + (shader._paddedShader && 'sample *= testSpriteBounds(coord);' || '') + `
						blurColor += sample;
					}
				}
				blurColor /= blurPixels;
				gl_FragColor = mix(texColor, blurColor, strength) * v_fragmentColor;
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

/////////////////////

cc.Class({
    extends: KernelShader,
	
	properties : {
		shaderProgramName : {
			get : function() {
				return 'ShaderSpriteBlur' + (this._paddedShader && 'PaddedR' || 'R' ) + Math.floor(this.kernelRadius);
			},
			visible : false
		}
	},
	
	compileShader : compileShader,

	drawFilteredCanvas : function(targetContext, srcImage, srcRect) {
		var padding = this.padding && Math.ceil(this._radius) || 0;
		targetContext.globalCompositeOperation = 'ligther';
		targetContext.globalAlpha = 1 / Math.pow(this.kernelRadius * 2 + 1, 1.5);//2);
	// doing what fragment shader does in WebGL
		var texStep = this._radius / this._kernelRadius;
		for(var x = -this.kernelRadius; x <= this.kernelRadius; x++) {
			for(var y = -this.kernelRadius; y <= this.kernelRadius; y++) {
				targetContext.drawImage(srcImage, 
					srcRect.x, srcRect.y, srcRect.width, srcRect.height,
					x * texStep + padding, y * texStep + padding, srcRect.width, srcRect.height
				);			
			}
		}
	},

	mixFilteredCanvas : function(targetContext, filteredCanvas, srcImage, srcRect) {
		var padding = this.padding && Math.ceil(this._radius) || 0;
		targetContext.globalCompositeOperation = 'source-over';
		targetContext.globalAlpha = 1 - this.strength;
		targetContext.drawImage(srcImage, srcRect.x, srcRect.y, srcRect.width, srcRect.height, padding, padding, srcRect.width, srcRect.height);
		targetContext.globalAlpha = this.strength;
		targetContext.drawImage(filteredCanvas, 0, 0);
	}

});