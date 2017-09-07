var WEBGL = (cc._renderType == cc.game.RENDER_TYPE_WEBGL);

var spine = sp.spine;
var proto = sp._SGSkeleton.WebGLRenderCmd.prototype;

// Modified copy from 1.5.1 spine:
// we use alpha-test sprite shader & each fragment has z equal to it's bonew drawing order
if(WEBGL) proto._uploadData = function (f32buffer, ui32buffer, vertexDataOffset, writeDepth){
    // rendering the cached data first
    cc.renderer._batchRendering();
    vertexDataOffset = 0;

    var node = this._node;
    var color = this._displayedColor, locSkeleton = node._skeleton;

    var textureAtlas, attachment, slot, i, n;
    var premultiAlpha = node._premultipliedAlpha && this._displayedOpacity == 255;
    var blendMode = -1;
    var dataInited = false;
	var cachedVertices = 0;
	var cachedIndices = 0;		// we've had some problems with overflowing the index buffer on custom-vertex geometry,
								// so we'll keep track of index count too, to batch render when needed
	var batchIndexCount = cc.macro.BATCH_VERTEX_COUNT / 4 * 6;

    var wt = this._worldTransform, mat = this._matrix.mat;
    mat[0] = wt.a;
    mat[4] = wt.c;
    mat[12] = wt.tx;
    mat[1] = wt.b;
    mat[5] = wt.d;
	mat[13] = wt.ty;

    this._shaderProgram.use();
	this._shaderProgram._setUniformForMVPMatrixWithMat4(this._matrix);
	//var uniLoc = gl.getUniformLocation(this._shaderProgram._programObj, cc.macro.UNIFORM_ALPHA_TEST_VALUE_S);
	//gl.uniform1f(uniLoc, cc.a || 0);

    locSkeleton.r = color.r / 255;
    locSkeleton.g = color.g / 255;
    locSkeleton.b = color.b / 255;
    locSkeleton.a = this._displayedOpacity / 255;
	if (premultiAlpha) {
        locSkeleton.r *= locSkeleton.a;
        locSkeleton.g *= locSkeleton.a;
        locSkeleton.b *= locSkeleton.a;
	}

    var debugSlotsInfo = null;
    if (this._node._debugSlots) {
        debugSlotsInfo = [];
    }

	var dz = 1 / (locSkeleton.drawOrder.length + 1) * (writeDepth ? 1 : 0);
	var vertexZ = node._vertexZ;
    for (i = 0, n = locSkeleton.drawOrder.length; i < n; i++) {
		node._vertexZ = vertexZ + i * dz;	// dirty hack for writing different depth for different bones with minimal code changes
		slot = locSkeleton.drawOrder[i];
        if (!slot.attachment)
            continue;
        attachment = slot.attachment;

        // get the vertices length
		var vertCount = 0;
		var indexCount = 0;
        if (attachment instanceof spine.RegionAttachment) {
			vertCount = 6; // a quad = two triangles = six vertices
			indexCount = 6;
        }
        else if (attachment instanceof spine.MeshAttachment) {
			vertCount = attachment.regionUVs.length / 2;
			indexCount = attachment.triangles.length;
        }
        else {
            continue;
        }

        // no vertices to render
        if (vertCount === 0) {
            continue;
        }
        var regionTextureAtlas = node.getTextureAtlas(attachment).texture;
        // init data at the first time
        if (!dataInited) {
            textureAtlas = regionTextureAtlas;
            blendMode = slot.data.blendMode;
            cc.renderer._updateBatchedInfo(textureAtlas.getRealTexture(), this._getBlendFunc(blendMode, premultiAlpha), this.getShaderProgram());
            dataInited = true;
        }
		
        // if data changed or the vertices will be overflow
		if ((cachedVertices + vertCount) * 6 > f32buffer.length ||
			cachedIndices + indexCount > batchIndexCount ||
			textureAtlas !== regionTextureAtlas ||
            blendMode !== slot.data.blendMode) {
            // render the cached data
			cc.renderer._batchRendering();
            vertexDataOffset = 0;
			cachedVertices = 0;
			cachedIndices = 0;

            // update the batched info
            textureAtlas = regionTextureAtlas;
            blendMode = slot.data.blendMode;
            cc.renderer._updateBatchedInfo(textureAtlas.getRealTexture(), this._getBlendFunc(blendMode, premultiAlpha), this.getShaderProgram());
        }

        // update the vertex buffer
        var slotDebugPoints = null;
        if (attachment instanceof spine.RegionAttachment) {
            slotDebugPoints = this._uploadRegionAttachmentData(attachment, slot, premultiAlpha, f32buffer, ui32buffer, vertexDataOffset);
        }
        else if (attachment instanceof spine.MeshAttachment) {
            this._uploadMeshAttachmentData(attachment, slot, premultiAlpha, f32buffer, ui32buffer, vertexDataOffset);
        }
        else {
            continue;
        }

        if (this._node._debugSlots) {
            debugSlotsInfo[i] = slotDebugPoints;
        }

        // update the index buffer
        if (attachment instanceof spine.RegionAttachment) {
            cc.renderer._increaseBatchingSize(vertCount, cc.renderer.VertexType.TRIANGLE);
        } else {
            cc.renderer._increaseBatchingSize(vertCount, cc.renderer.VertexType.CUSTOM, attachment.triangles);
        }

        // update the index data
        cachedVertices += vertCount;
		vertexDataOffset += vertCount * 6;
		cachedIndices += indexCount;
    }
	node._vertexZ = vertexZ;		// restore node depth

    // render the left vertices
    if (cachedVertices > 0) {
        cc.renderer._batchRendering();
    }

    if (node._debugBones || node._debugSlots) {
        cc.math.glMatrixMode(cc.math.KM_GL_MODELVIEW);
        //cc.math.glPushMatrixWitMat4(this._matrix);
        cc.current_stack.stack.push(cc.current_stack.top);
        cc.current_stack.top = this._matrix;
        var drawingUtil = cc._drawingUtil;

        if (node._debugSlots && debugSlotsInfo && debugSlotsInfo.length > 0) {
            // Slots.
            drawingUtil.setDrawColor(0, 0, 255, 255);
            drawingUtil.setLineWidth(1);

            for (i = 0, n = locSkeleton.slots.length; i < n; i++) {
                var points = debugSlotsInfo[i];
                if (points) {
                    drawingUtil.drawPoly(points, 4, true);
                }
            }
        }

        if (node._debugBones) {
            // Bone lengths.
            var bone;
            drawingUtil.setLineWidth(2);
            drawingUtil.setDrawColor(255, 0, 0, 255);

            for (i = 0, n = locSkeleton.bones.length; i < n; i++) {
                bone = locSkeleton.bones[i];
                var x = bone.data.length * bone.a + bone.worldX;
                var y = bone.data.length * bone.c + bone.worldY;
                drawingUtil.drawLine(cc.p(bone.worldX, bone.worldY), cc.p(x, y));
            }

            // Bone origins.
            drawingUtil.setPointSize(4);
            drawingUtil.setDrawColor(0, 0, 255, 255); // Root bone is blue.

            for (i = 0, n = locSkeleton.bones.length; i < n; i++) {
                bone = locSkeleton.bones[i];
                drawingUtil.drawPoint(cc.p(bone.worldX, bone.worldY));
                if (i == 0) {
                    drawingUtil.setDrawColor(0, 255, 0, 255);
                }
            }
        }
        cc.math.glPopMatrix();
    }

    return 0;
};

cc.a = 0.85
if(WEBGL) proto.uploadData = function(f32buffer, ui32buffer, vertexDataOffset) {
	var opacity = this._displayedOpacity;
	if(opacity < 255 || this.kernelShader) {
		// cheap transparent mode
		if(cc.macro.SPINE_TRANSPARENCY_FAST && !this.kernelShader) {
			var program = cc.shaderCache.programForKey(cc.macro.SHADER_POSITION_TEXTURECOLORALPHATEST);
			this.setShaderProgram(program);

			// depth pass
			gl.enable(gl.DEPTH_TEST);
			gl.depthMask(true);
			gl.depthFunc(gl.LEQUAL);
			gl.colorMask(false, false, false, false);
			this._uploadData(f32buffer, ui32buffer, vertexDataOffset, true);

			// color pass
			gl.enable(gl.DEPTH_TEST);
			gl.depthMask(false);
			gl.depthFunc(gl.EQUAL);
			gl.colorMask(true, true, true, true);
			this._uploadData(f32buffer, ui32buffer, vertexDataOffset, true);

			// restore depth buffer state & clear it
			gl.depthFunc(gl.LEQUAL);
			gl.depthMask(true);
			gl.clear(gl.DEPTH_BUFFER_BIT);
		} 
		// high-quality transparency
		else {
			getSpineFbo();
			
			var vSize = cc.view.getVisibleSize();
			var _oldFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
			gl.bindFramebuffer(gl.FRAMEBUFFER, _spineFbo);
		// clear texture
			var clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
			gl.clearColor(0, 0, 0, 0);
			//gl.clearColor(1, 1, 1, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
		// restore clear color
			gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
		// save current viewport
			var viewport = gl.getParameter(gl.VIEWPORT);
			gl.viewport(0, 0, _fboSize.width, _fboSize.height);

		// Spine shader uses both ModelView and projection matrix - MV for wolrd node placing, proj for viewport projection
		// however some ugly parts of cocos tend to use projection matrix as MVP matrix
		// thus when we render spine node to screen-space buffer (that's what happens here),
		// we need to set both MV and P matrices just to be sure no random transforms will happen
			var projStack = cc.math.projection_matrix_stack;
			projStack.push(_worldProjMatrix);

			this._displayedOpacity = 255;
			var postProgram = this.getShaderProgram();
			//	this.setShaderProgram(cc.shaderCache.programForKey(cc.macro.SHADER_POSITION_TEXTURECOLOR));		1.5
			this.setShaderProgram(cc.shaderCache.programForKey(cc.macro.SHADER_SPRITE_POSITION_TEXTURECOLOR));		//1.6
			this._uploadData(f32buffer, ui32buffer, vertexDataOffset, false);
			this.getShaderProgram()._setUniformForMVPMatrixWithMat4(_identityMatrix);

			this._displayedOpacity = opacity;

			projStack.pop();
			gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
			gl.bindFramebuffer(gl.FRAMEBUFFER, _oldFBO);
			this.setShaderProgram(postProgram);

			vertexDataOffset = 0;	// spine's _uploadData calls _batchRendering in any case
			
			var wt = this._node.getNodeToWorldTransform();
			this._node._skeleton.getBounds(_offset, _size);
			var pad = this._shaderPadding || 0;
			var vertices = [];
			vertices[0] = new cc.Vec2(_offset.x - pad, _offset.y + _size.y + pad);
			vertices[1] = new cc.Vec2(_offset.x - pad, _offset.y - pad);
			vertices[2] = new cc.Vec2(_offset.x + _size.x + pad, _offset.y + _size.y + pad);
			vertices[3] = new cc.Vec2(_offset.x + _size.x + pad, _offset.y - pad);

			cc.v = vertices;

			var color = opacity << 24 | opacity << 16 | opacity << 8 | opacity;
			for(var i = 0; i < vertices.length; i++) {
				var v = cc.pointApplyAffineTransform(vertices[i], wt);
				f32buffer[vertexDataOffset] = v.x;
				f32buffer[vertexDataOffset + 1] = v.y;
				f32buffer[vertexDataOffset + 2] = this._node._vertexZ;
				ui32buffer[vertexDataOffset + 3] = color;
				f32buffer[vertexDataOffset + 4] = v.x / _fboSize.width;
				f32buffer[vertexDataOffset + 5] = v.y / _fboSize.height;
				vertexDataOffset += 6;
			}
		
			var tex = _spineFboTexture;
			//cc.renderer._updateBatchedInfo(tex, {src : cc.macro.BLEND_SRC, dst : cc.macro.BLEND_DST}, this.getShaderProgram());
			cc.renderer._updateBatchedInfo(tex, {src : cc.macro.BLEND_SRC, dst : cc.macro.BLEND_DST}, postProgram);
			cc.renderer._increaseBatchingSize(4, cc.renderer.VertexType.QUAD);
			cc.renderer._batchRendering();

			cc.cmd = this;
		}
	} else {
		this.setShaderProgram(cc.shaderCache.programForKey(cc.macro.SHADER_SPRITE_POSITION_TEXTURECOLOR));
		this._uploadData(f32buffer, ui32buffer, vertexDataOffset, false);
	}
};

// kernel shader support stuff:
proto.getTexture = function() {
	return _spineFboTexture;
}

sp._SGSkeletonAnimation.prototype.setPadding = function(padding) {
	this._renderCmd._shaderPadding = padding;
}

var _offset = new cc.Vec2();
var _size = new cc.Vec2();
_offset.set = _size.set = function(x, y) {
	if(y === undefined) {
		y = x.y;
		x = x.x;
	}
	this.x = x;
	this.y = y;
}

var _spineFbo;
var _spineFboTexture;
var _fboSize;
var _worldProjMatrix;
var _identityMatrix = new cc.math.Matrix4();
_identityMatrix.identity();
var getSpineFbo = function() {
	if(!_spineFbo) {
		var size = _fboSize = CC_EDITOR ? new cc.Size(1920, 1080) : cc.view.getDesignResolutionSize();
		_worldProjMatrix = cc.math.mat4OrthographicProjection(new cc.math.Matrix4(), 0, size.width, 0, size.height, -1024, 1024);
		var canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;	
		_spineFboTexture = new cc.Texture2D();
		_spineFboTexture.initWithElement(canvas);
		_spineFboTexture.handleLoadedTexture(true);

		var oldRBO = gl.getParameter(gl.RENDERBUFFER_BINDING);
		var oldFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		// generate FBO
		_spineFbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, _spineFbo);
		// associate texture with FBO
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, _spineFboTexture._webTextureObj, 0);		
		
		if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
			console.error("Could not attach texture to the framebuffer");
		gl.bindRenderbuffer(gl.RENDERBUFFER, oldRBO);
		gl.bindFramebuffer(gl.FRAMEBUFFER, oldFBO);
	}
	cc._spineFbo = _spineFbo;
	cc._spineFboTexture = _spineFboTexture;
	cc._spineFboSpriteFrame = new cc.SpriteFrame(_spineFboTexture);
	return _spineFbo;
}
if(WEBGL && !CC_EDITOR) getSpineFbo();