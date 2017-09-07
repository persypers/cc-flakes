/*
 * Runs actions in parallel
 * @class Repeat
 * @extends ActionInterval
 * @param {Action} action to be repeated
 * @param {integer} number of times to repeat action.
 */
cc.Repeat = cc.ActionInterval.extend({
    _action:null,
    _times:0,
    _timesToRepeat:0,
    _repeatForever:false,

    ctor:function (action, times) {
        cc.ActionInterval.prototype.ctor.call(this);
        this.initWithAction(action, times);
    },

    initWithAction:function (action, times) {
        this._action = action;
        this._timesToRepeat = times;
        this._repeatForever = !times || times <= 0;
        return true;
    },

    clone:function () {
        var action = new cc.Repeat();
        this._cloneDecoration(action);
        action.initWithAction(this._action.clone(), this._timesToRepeat);
        return action;
    },

    startWithTarget:function (target) {
        cc.ActionInterval.prototype.startWithTarget.call(this, target);
        this._target = target;
        this._times = this._repeatForever && 1 || this._timesToRepeat;
        this._action.startWithTarget(target);
    },

    stop:function () {
        this._times = 0;
        this._action.stop();
        cc.Action.prototype.stop.call(this);
    },

    step:function (dt) {
        this._action.step(dt);
        if(this._action.isDone()) {
            !this._repeatForever && this._times--;
            if(this._times > 0) {
                this._action.startWithTarget(this._target);
            }
        }
    },

    update:function(dt) {
        this.step(dt);
    },

    isDone : function() {
        return this._times <= 0;
    },

    reverse:function () {
        return this.clone();
    }
});

/*
 * Runs actions in parallel
 * @class Repeat
 * @extends ActionInterval
 * @param {Action} action to be repeated
 * @param {integer} number of times to repeat action.
 */
 cc.repeat = function (action, times) {
    return new cc.Repeat(action, times);
};