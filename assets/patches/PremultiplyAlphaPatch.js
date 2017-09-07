/**
 *  Premultipliying alpha upon loading texture in webgl would save all the troubles
 *	with transparent canvas artifacts and alpha bleeding, 
 *	but as of v1.3.1 automatic premultipliying is not yet implemented
 */

/**
 *  This file overrides effect of cc.Sprite serialized blendFunc properties.
 *  If you need to use specific srcBlendFactor or dstBlendFactor value,
 * 	you'll have to set the explicitly from your scripts
 */
cc.macro.AUTO_PREMULTIPLIED_ALPHA_FOR_PNG = 1;
cc.macro.OPTIMIZE_BLEND_FUNC_FOR_PREMULTIPLIED_ALPHA = cc.macro.AUTO_PREMULTIPLIED_ALPHA_FOR_PNG;

if(cc._renderType === cc.game.RENDER_TYPE_WEBGL && !cc.Texture2D.prototype._handleLoadedTexturePrePatch) {
	cc.Texture2D.prototype._handleLoadedTexturePrePatch = cc.Texture2D.prototype.handleLoadedTexture;
	cc.Texture2D.prototype.handleLoadedTexture = function(premultiplied) {
		cc.assert(! this._handleOnBind, 'Texture.handleLoadedTexture: ' +  this._url);
		premultiplied === undefined && (premultiplied = cc.macro.AUTO_PREMULTIPLIED_ALPHA_FOR_PNG);
		var htmlObj = this._htmlElementObj;
		// after 1.5 webgl mode now deletes _htmlElementObj in _handleLoadedTexture
		// but we use it for some rendering techniques, so we will keep it for now
		this._handleLoadedTexturePrePatch(premultiplied);
		this._htmlElementObj = htmlObj;
	}
}

// 1.4 equivalent of _onTextureLoaded
cc.Sprite.prototype._onSpriteFrameLoaded = function (event) {
	var self = this;
	var sgNode = this._sgNode;
	sgNode.setSpriteFrame(self._spriteFrame);
	
	var texture = self._spriteFrame && self._spriteFrame.getTexture(); 
// override blend mode when using premultiplied alpha texture
	if(texture && texture.hasPremultipliedAlpha()) {
		sgNode._opacityModifyRGB = true;
	} else {
		sgNode._opacityModifyRGB = false;
	}
	self._applyCapInset();
	self._applySpriteSize();
	if (self.enabledInHierarchy && !sgNode.isVisible()) {
		sgNode.setVisible(true);
	}
}

// 1.5.1
cc.Sprite.prototype._onTextureLoaded = function (event) {
	var self = this;
	if (!self.isValid) {
		return;
	}
	var sgNode = self._sgNode;
	sgNode.setSpriteFrame(self._spriteFrame);
	self._applySpriteSize();
	if (self.enabledInHierarchy && !sgNode.isVisible()) {
		sgNode.setVisible(true);
	}
	var texture = self._spriteFrame && self._spriteFrame.getTexture(); 
// override blend mode when using premultiplied alpha texture
	if(texture && texture.hasPremultipliedAlpha()) {
		sgNode._opacityModifyRGB = true;
	} else {
		sgNode._opacityModifyRGB = false;
	}
}

cc.Sprite.prototype._initSgNode = function () {
	this._applySpriteFrame(null);
	var sgNode = this._sgNode;

	// should keep the size of the sg node the same as entity,
	// otherwise setContentSize may not take effect
	sgNode.setContentSize(this.node.getContentSize(true));
	this._applySpriteSize();

	sgNode.setRenderingType(this._type);
	sgNode.setFillType(this._fillType);
	sgNode.setFillCenter(this._fillCenter);
	sgNode.setFillStart(this._fillStart);
	sgNode.setFillRange(this._fillRange);
	sgNode.enableTrimmedContentSize(this._isTrimmedMode);
	this._blendFunc.src = cc.macro.BLEND_SRC;
	this._blendFunc.dst = cc.macro.BLEND_DST;
	sgNode.setBlendFunc(this._blendFunc);
}