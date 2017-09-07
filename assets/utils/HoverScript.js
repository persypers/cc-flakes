/**
 *  Script for animating hovers and alike - stuff with a finite animation which can be reversed mid-air 
 **/

cc.Class({
    extends: cc.Component,
    
	properties : {
		clip : cc.AnimationClip,
		animation : cc.Animation,
		disableNode : {
			default : false,
			tooltip : 'When set to true, HoverScript will enable node on fadeIn and disable after fadeOut'
		},
		mouseEnterHover : {
		    default : false,
		    tooltip : 'When set true enables itself on MOUSE_ENTER and MOUSE_LEAVE events'
		},
		cursorStyleEnables : {
			default : false
		}
	},

	onLoad : function() {
		var anim = this.animation || this.node.getComponent(cc.Animation);
		anim.on('finished', this.onFinished, this);
		if(this.mouseEnterHover) {
		    this.node.on(cc.Node.EventType.MOUSE_ENTER, this.fadeIn, this);
		    this.node.on(cc.Node.EventType.MOUSE_LEAVE, this.fadeOut, this);
		}
	},

    fadeIn : function(onDone) {
		if(this.cursorStyleEnables) cc._canvas.style.cursor = 'pointer';
		this.node.active = true;
		this._onDone = onDone;
		var anim = this.animation || this.node.getComponent(cc.Animation);
		var clip = this.clip && this.clip.name || anim.defaultClip.name;
		var state = anim.getAnimationState(clip);
        var stateTime = state.duration - state.time;
		state.wrapMode = cc.WrapMode.Normal;
        if(state.isPlaying) {
            if(this._fadeOut) {
                state.time = stateTime;
            }
        } else {
            anim.playAdditive(clip);
        }
        this._fadeOut = false;
    },

    fadeOut : function(onDone) {
		if(this.cursorStyleEnables) cc._canvas.style.cursor = 'default';
		this.node.active = true;
		this._onDone = onDone;
		var anim = this.animation || this.node.getComponent(cc.Animation);
		var clip = this.clip && this.clip.name || anim.defaultClip.name;
        var state = anim.getAnimationState(clip);
		var stateTime = state.duration - state.time;
		state.wrapMode = cc.WrapMode.Reverse;
		if(state.isPlaying) {
            if(!this._fadeOut) {
				state.time = stateTime;
            }
        } else {
            state.wrapMode = cc.WrapMode.Reverse;
			anim.playAdditive(clip);
        }
        this._fadeOut = true;
    },

	onFinished : function() {
		if(this._fadeOut && this.disableNode) {
			this.node.active = false;
		}
		var f = this._onDone;
		this._onDone = null;
		if(typeof(f) == 'function') {
			f();
		}
	}

});
