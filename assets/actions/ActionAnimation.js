/**
 *  Wrap a Animation.play(clip) in cc.Action
 *  Start playing animation by running action. Action then waits for animation clip to stop playing
 *  @param anim {cc.Animation} animation component. Screw cc.Action's target logic!
 *  @param clip {String} animation clip to be played
 *  @param wrapMode {String} wrapMode to play clip with
 */
cc.ActionAnimation = cc.FiniteTimeAction.extend({
    _anim : null,
    _clip : null,
    _wrapMode : null,

    ctor:function (anim, clip, wrapMode) {
        cc.FiniteTimeAction.prototype.ctor.call(this);
        this.initWithAnimation(anim, clip, wrapMode);
    },

    initWithAnimation:function (anim, clip, wrapMode) {
        if(anim instanceof cc.Animation) {
            this._anim = anim;
        } else if(anim.getComponent) {
            this._anim = anim.getComponent(cc.Animation);
        } else {
            return false;
        }
        this._clip = clip || this._anim.defaultClip.name;
        this._wrapMode = wrapMode;
        return true;
    },

    step : function() {
        var state = this._anim.getAnimationState(this._clip);
        this._isDone = !state.isPlaying;
    },
    
    update : function() {
        this.step();
    },
    
    startWithTarget : function(target) {
        cc.Action.prototype.startWithTarget.call(this, target);
        this._isDone = false;
        if(!this._anim) {
            this._anim = target.getComponent(cc.Animation);
        }
        if(this._anim instanceof cc.Animation) {
            var state = this._anim.getAnimationState(this._clip);
            if(this._wrapMode) {
                state.wrapMode = this._wrapMode;
            }
            this._anim.playAdditive(this._clip);
        } else {
            cc.warn("cc.animate() run on wrong target: " + (target.name || target));
			this._isDone = true;
        }
    },
    
    stop : function() {
        this._anim.stop(this._clip);
        this._isDone = true;
    },
    
    clone : function() {
        return new cc.ActionAnimation(this._anim, this._clip, this._wrapMode);
    },
    
    isDone : function() {
        return this._isDone;
    }
    
});

/**
 *  Wrap a Animation.play(clip) in cc.Action
 *  Start playing animation by running action. Action then waits for animation clip to stop playing
 *  @param anim {cc.Animation} animation component. Screw cc.Action's target logic!
 *  @param clip {String} animation clip to be played
 *  @param wrapMode {String} wrapMode to play clip with
 */
cc.animate = function (anim, clip, wrapMode) {
    return new cc.ActionAnimation(anim, clip, wrapMode);
};


