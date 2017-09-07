/*
 * Runs actions in parallel
 * @class Spawn
 * @extends ActionInterval
 * @param {Array|Action} array of actions
 */
cc.Spawn = cc.ActionInterval.extend({
    _actions:null,
    _doneCache:[],

    ctor:function (actions) {
        cc.ActionInterval.prototype.ctor.call(this);
        this.initWithActions(actions)
    },

    initWithActions:function (actions) {
        this._actions = actions;
        return true;
    },

    clone:function () {
        var action = new cc.Spawn();
        this._cloneDecoration(action);
        var actions = [];
        for(var i = 0; i < this._actions.length; i++)
            actions[i] = this._actions[i].clone();
        action.initWithActions(actions);
        return action;
    },

    startWithTarget:function (target) {
        cc.ActionInterval.prototype.startWithTarget.call(this, target);
        this._target = target;
        this._isDone = false;
        this._doneCache = [];
        for(var i = 0; i < this._actions.length; i++) {
            this._actions[i].startWithTarget(this._target);
            this._doneCache[i] = false;
        }
    },

    stop:function () {
        for(var i = 0; i < this._actions.length; i++) {
            this._actions[i].stop();
            this._doneCache[i] = true;
        }
        this._isDone = true;
        cc.Action.prototype.stop.call(this);
    },

    step:function (dt) {
        var done = true;
        var locActions = this._actions;
        var doneCache = this._doneCache;
        for(var i = 0; i < locActions.length; i++) {
            if(doneCache[i])
                continue;
            var a = locActions[i];
            a.step(dt);
            if(a.isDone()) {
                doneCache[i] = true;
            } else {
                done = false
            }
        }
        this._isDone = done;
    },

    update:function(dt) {
        this.step(dt);
    },

    isDone : function() {
        return this._isDone;
    },

    reverse:function () {
        return this.clone();
    }
});

/*
 * Runs actions in parallel
 * @class Spawn
 * @extends ActionInterval
 * @param {Array|Action} array of actions
 */
cc.spawn = function (actions) {
    return new cc.Spawn((actions instanceof Array) ? actions : arguments);
};