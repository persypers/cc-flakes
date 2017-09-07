/**
 *  Workaround for reading pixel data from textures and sprites
 *  (we can't do it freely on web platform due to security reasons)
 */

cc.Texture2D.prototype.getPixelData = function() {
    if(!this._pixelData) {
		var canvas = document.createElement('canvas');
		canvas.width = this.width;
		canvas.height = this.height;
		var ctx = canvas.getContext('2d');
		ctx.drawImage(this.getHtmlElementObj(), 0, 0);
		this._pixelData = ctx.getImageData(0, 0, this.width, this.height);
	}
	return this._pixelData;
}

/**
 * Returns a color of a sprite in a given coordinates.
 * Takes coordinates in node space as two floats or cc.Vec2
 * 
 */
cc.Sprite.prototype.readPixel = function(x, y) {
	var sprite = this.spriteFrame;
	var texture = sprite.getTexture();
	var spriteRect = this.trim && sprite.getRect() || cc.rect(0, 0, texture.width, texture.height);
	var nodeSize = this.node.getContentSize();
	if(typeof(x) == 'object') {
		y = x.y;
		x = x.x;
	}
// convert coordinates from node space to texture cooridnates
	switch(this.type) {

		case (cc.Sprite.Type.SLICED) : {
			console.warn("Sprite.readPixel() : not implemented for SLICED sprite type");
			return;
		}
		case (cc.Sprite.Type.TILED) : {
			console.warn("Sprite.readPixel() : not implemented for TILED sprite type");
			return;			
		}
		default : {
			if(sprite.isRotated()) {
				var _x = x;
				x = y;
				y = _x;
			} else {
				y = (nodeSize.height - y);
			}

			x = Math.floor(spriteRect.x + (x / nodeSize.width * spriteRect.width));
			//y = Math.floor(spriteRect.y + ((nodeSize.height - y) / nodeSize.height * spriteRect.height));
			y = Math.floor(spriteRect.y + (y / nodeSize.height * spriteRect.height));
		}

	}
	

// get pixelData buffer index
	var pixelData = texture.getPixelData();
	if(x < 0 || x >= pixelData.width || y < 0 || y >= pixelData.height) {
		return false;
	}
	var i = (y * pixelData.width + x) * 4;
	return new cc.Color(
		pixelData.data[i],
		pixelData.data[i + 1],
		pixelData.data[i + 2],
		pixelData.data[i + 3]
	);
}

/**
 * Same as readPixel but for world coordinates argument
 */
cc.Sprite.prototype.readPixelWorld = function(p, y) {
	if(! (p instanceof cc.Vec2)) {
		p = new cc.Vec2(p, y);
	}
	var worldToNode = cc.affineTransformInvert(this.node.getNodeToWorldTransform());
	var nodePoint = cc.pointApplyAffineTransform(p, worldToNode);
	return this.readPixel(nodePoint);
} 