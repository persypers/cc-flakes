/**
 * Render target node - a node that renders children into texture
 */

/**
 * All buffer render cmds are discarded when they are drawn by default or when switching occurs, so we modify this behaviour:
 */
if(cc._renderType == cc.game.RENDER_TYPE_WEBGL) {
	// modified copy from 1.5.1 - added dontClear arg
	cc.renderer._turnToCacheMode= function (renderTextureID, dontClear) {
		this._isCacheToBufferOn = true;
		renderTextureID = renderTextureID || 0;
		if (!this._cacheToBufferCmds[renderTextureID]) {
			this._cacheToBufferCmds[renderTextureID] = [];
		}
		else if(!dontClear){
			this._cacheToBufferCmds[renderTextureID].length = 0;
		}
		if (this._cacheInstanceIds.indexOf(renderTextureID) === -1) {
			this._cacheInstanceIds.push(renderTextureID);
		}
		this._currentID = renderTextureID;
	};

	// modified copy from 1.5.1 - added dontClear arg
	cc.renderer._renderingToBuffer = function (renderTextureId, dontClear) {
		renderTextureId = renderTextureId || this._currentID;
		var locCmds = this._cacheToBufferCmds[renderTextureId];
		var ctx = cc._renderContext;
		this.rendering(ctx, locCmds);
		if(!dontClear) this._removeCache(renderTextureId);
	// wtf? this is plain stupid, but at least it doesn't hurt us:
		var locIDs = this._cacheInstanceIds;
		if (locIDs.length === 0)
			this._isCacheToBufferOn = false;
		else
			this._currentID = locIDs[locIDs.length - 1];
	};
} else if(cc._renderType == cc.game.RENDER_TYPE_CANVAS) {
	// modified copy from 1.5.1 - added dontClear arg
	cc.renderer._turnToCacheMode= function (renderTextureID, dontClear) {
		this._isCacheToCanvasOn = true;
        renderTextureID = renderTextureID || 0;
		if(!this._cacheToCanvasCmds[renderTextureID] || !dontClear)
			this._cacheToCanvasCmds[renderTextureID] = [];
        if(this._cacheInstanceIds.indexOf(renderTextureID) === -1)
            this._cacheInstanceIds.push(renderTextureID);
        this._currentID = renderTextureID;
	},

	// modified copy from 1.5.1 - added dontClear arg
    cc.renderer._renderingToCacheCanvas = function (ctx, instanceID, scaleX, scaleY, dontClear) {
		//console.log('RenderToCanvas', instanceID, this._cacheToCanvasCmds[instanceID].length);
		if (!ctx)
            cc.logID(7600);
        scaleX = scaleX === undefined ? 1 : scaleX;
        scaleY = scaleY === undefined ? 1 : scaleY;
        instanceID = instanceID || this._currentID;
        var locCmds = this._cacheToCanvasCmds[instanceID], i, len;
        ctx.computeRealOffsetY();
        for (i = 0, len = locCmds.length; i < len; i++) {
            locCmds[i].rendering(ctx, scaleX, scaleY);
        }
        if(!dontClear) this._removeCache(instanceID);

        var locIDs = this._cacheInstanceIds;
        if (locIDs.length === 0)
            this._isCacheToCanvasOn = false;
        else
            this._currentID = locIDs[locIDs.length - 1];
	};
	
	// after 1.5.1 _collectDirtyRegion no longer checks buffered canvas cmd lists
	cc.renderer._collectDirtyRegionDefault = cc.renderer._collectDirtyRegion;
	cc.renderer._collectDirtyRegion = function() {
		var _renderCmds = this._renderCmds;
		var result = true;
		for(var k in this._cacheToCanvasCmds) {
			this._renderCmds = this._cacheToCanvasCmds[k];
			result = result && this._collectDirtyRegionDefault();
		}
		this._renderCmds = _renderCmds;
		return result && this._collectDirtyRegionDefault();
	}
}

// Modified copy of _ccsg.Node.visit v1.4.2
var sgNodeVisit = function(parent) {
	// quick return if not visible
	if (!this._visible)
		return;
	var renderer = cc.renderer, cmd = this._renderCmd;
	cmd.visit(parent && parent._renderCmd);
	var children = this._children;
	var len = children.length;

	renderer.pushRenderCommand(cmd);	// this._renderGL() call from cc.renderer.rendering mainloop cycle
	
	var spriteNode = cmd._spriteNode;
	spriteNode && spriteNode.visit(this);
	
	var prevTarget = cc.renderer._isCacheToBufferOn;
	if(cc._renderType == cc.game.RENDER_TYPE_CANVAS) {
		var t = spriteNode._renderCmd._transform;
		cmd._worldTransform = {a : t.a, b : t.b, c : t.c, d : t.d, tx : -t.tx, ty : -t.ty};
		prevTarget = cc.renderer._isCacheToCanvasOn;
	}

	if(len > 0) {
		if (this._reorderChildDirty) {
        	this.sortAllChildren();
    	}
		var prevTargetID = cc.renderer._currentID;
//		console.log('--> rt visit', this.__instanceId, prevTarget && prevTargetID);
		cc.renderer._turnToCacheMode(this.__instanceId, false);
		for(var i = 0; i < len; i++){
			if(children[i] == spriteNode) continue;
			children[i].visit(this);
		}
		if(prevTarget) {
			renderer._turnToCacheMode(prevTargetID, true);
		} else {
			renderer._turnToNormalMode();
		}
//		console.log('<-- rt visit', this.__instanceId, prevTarget && prevTargetID);
	}
	cmd._dirtyFlag = 0;
};

cc.Class({
	extends: cc._RendererUnderSG,

    properties: {
    },

/**
 * Required for cc._RendererUnderSG
 */
	_createSgNode : function() {
		return new cc.Scale9Sprite();
	},
/**
 * Required for cc._RendererUnderSG
 */
	_initSgNode : function() {
        var sgNode = this._sgNode;
        sgNode.setContentSize(this.node.getContentSize(true));
	},

    onLoad: function () {
		this._cmdCacheId = this.node._sgNode.__instanceId;

		this.node.setCascadeOpacityEnabled(false);
		this.node.on('size-changed', this._initTexture, this);
		this._initTexture();
    },

	_initTexture : function() {
		this.onDestroy();
		var nodeSize = this.node.getContentSize();
		if(nodeSize.width === 0 || nodeSize.height === 0) return;
		var canvas = document.createElement('canvas');
		canvas.width = nodeSize.width;
		canvas.height = nodeSize.height;	
		this._texture = new cc.Texture2D();
		this._texture.initWithElement(canvas);
		this._texture.handleLoadedTexture(true);
		this.spriteFrame = new cc.SpriteFrame(this._texture);

		if(cc._renderType == cc.game.RENDER_TYPE_WEBGL) {
			var oldRBO = gl.getParameter(gl.RENDERBUFFER_BINDING);
			var oldFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		// generate FBO
			this._fBO = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._fBO);
		// associate texture with FBO
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._texture._webTextureObj, 0);		
		
			if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
				console.error("Could not attach texture to the framebuffer");

			gl.bindRenderbuffer(gl.RENDERBUFFER, oldRBO);
			gl.bindFramebuffer(gl.FRAMEBUFFER, oldFBO);
			this._matrixDirty = true;
		} else if(cc._renderType == cc.game.RENDER_TYPE_CANVAS) {
			this._ctx = new cc.CanvasContextWrapper(canvas.getContext('2d'));
			this.node._sgNode.setContentSize(nodeSize);
		}

		this._sgNode.setSpriteFrame(this.spriteFrame);
		this._sgNode.setContentSize(nodeSize);
	},

	onEnable : function() {
		this._super();
	// switch renderCmd methods
		var cmd = this.node._sgNode._renderCmd;
		this.node._sgNode.visit = sgNodeVisit;
		cmd._spriteNode = this._sgNode;
		cmd._rt = this;
		if(cc._renderType == cc.game.RENDER_TYPE_WEBGL) {
			cmd.updateStatus = function() {
				this.__proto__.updateStatus.call(this);
				this._rt._matrixDirty = true;
			};
			cmd.transform = function(parentCmd, recursive) {				
				this.__proto__.transform.call(this, parentCmd, recursive);
				this._rt._matrixDirty = true;
			}
			cmd.rendering = function() {
				this._rt._renderGL();
			};
			cmd._needDraw = true;
		} else if(cc._renderType == cc.game.RENDER_TYPE_CANVAS) {
			cmd.updateStatus = function() {
				//console.log('canvas -> updateStatus');
				this.__proto__.updateStatus.call(this);
				this._currentRegion = this._spriteNode._renderCmd._currentRegion;
			};
			cmd.rendering = function(wrapper, scaleX, scaleY) {
				//console.log('canvas -> render');
				this._rt._renderCanvas(wrapper, scaleX, scaleY);
			};
			cmd.transform = function(parentCmd, recursive) {				
				//console.log('canvas -> transform');
				this.__proto__.transform.call(this, parentCmd);
				
				if(recursive) {
					var children = this._node._children;
					var len = children.length;
					var spriteNode = this._spriteNode;
					spriteNode._renderCmd.transform(this, recursive);
					var t = spriteNode._renderCmd._transform;
					this._worldTransform = {a : t.a, b : t.b, c : t.c, d : t.d, tx : -t.tx, ty : -t.ty};
					for(var i = 0; i < len; i++) {
						if(children[i] == spriteNode) continue;
						children[i]._renderCmd.transform(this, recursive);
					}
				}
			};
			cmd._needDraw = true;			
		}
		if(CC_EDITOR) {
			cc.director.on(cc.Director.EVENT_AFTER_VISIT, this._editorUpdate, this);
		}
		this.node.setNodeDirty();
		cc.rt = this;
	},

	onDisable : function() {
		this._super();
	// restore original renderCmd methods
		var cmd = this.node._sgNode._renderCmd;
		this.node._sgNode.visit = Object.getPrototypeOf(this.node._sgNode).visit;
		cmd.updateStatus = cmd.__proto__.updateStatus;
		cmd.transform = cmd.__proto__.transform;
		cmd.rendering = null;
		cmd._needDraw = false;
		if(CC_EDITOR) {
			cc.director.off(cc.Director.EVENT_AFTER_VISIT, this._editorUpdate, this);
		}
		cc.renderer._removeCache(this._cmdCacheId);
		this.node.setNodeDirty();
	},

	_editorUpdate : CC_EDITOR && function() {
		this._matrixDirty = true;
	},

	onDestroy : function() {
		if(this.spriteFrame) {
			this.spriteFrame.destroy();
		}
		if(this._texture) {
			this._texture.destroy();
		}
		if(cc._renderType == cc.game.RENDER_TYPE_WEBGL && this._fBO) {
			gl.deleteFramebuffer(this._fBO);
			delete this._fBO;
		}
	},

	_updateGLMatrix : function() {
		var t = this.node.getWorldToNodeTransform();
		var mat = new cc.math.Matrix4();
		mat.mat[0] = t.a;
		mat.mat[1] = t.b;
		mat.mat[4] = t.c;
		mat.mat[5] = t.d;
		mat.mat[10] = 1;
		mat.mat[12] = t.tx// - this._rtWidth * 0.5;
		mat.mat[13] = t.ty// - this._rtHeight * 0.5;
		mat.mat[15] = 1;
		var rtProj = cc.math.mat4OrthographicProjection(new cc.math.Matrix4(), 0, this.node.width, 0, -this.node.height, -1024, 1024);
		var newProj = cc.math.mat4Multiply(new cc.math.Matrix4(), rtProj, mat);
		this._projectionMatrix = newProj;
		newProj.mat[12] += this.node.anchorX * 2;
		newProj.mat[13] += (1 - this.node.anchorY) * 2;
		this._matrixDirty = false;
	},

/**
 * Draw frame
 */
	_renderGL : function() {
		if(this._matrixDirty) this._updateGLMatrix();
		var _oldFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._fBO);	
	// clear texture
		var clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	// restore clear color
		gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
	// save current viewport
		var viewport = gl.getParameter(gl.VIEWPORT);
		gl.viewport(0, 0, this.node.width, this.node.height);
	
	// switch projection matrix
		cc.math.glMatrixMode(cc.math.KM_GL_PROJECTION);
		cc.current_stack.push(this._projectionMatrix);

	// draw cached children render commands
		cc.renderer._renderingToBuffer(this._cmdCacheId, true);
	// restore matrix, viewport and FBO
		cc.math.glMatrixMode(cc.math.KM_GL_PROJECTION);
		cc.current_stack.pop();
		//cc.current_stack.lastUpdated = -1;	// v1.4.2 bug: projection matrix per GLprogram "dirtyness" is defined by frame counter >_<
		//cc.gl.setProjectionMatrixDirty();

		gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
		gl.bindFramebuffer(gl.FRAMEBUFFER, _oldFBO);
	},

	_renderCanvas : function() {
		var wrapper = this._ctx;
		var ctx = wrapper.getContext();
		var spriteRect = this.spriteFrame._rect;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, spriteRect.width, spriteRect.height);
		cc.renderer._renderingToCacheCanvas(this._ctx, this._cmdCacheId, 1, 1, true);
	}

});