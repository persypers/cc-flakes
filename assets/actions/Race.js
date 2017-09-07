/*
 * Runs actions in parallel, but when one of them isDone(), stops all others and is considered done
 * @class Race
 * @extends ActionInterval
 * @param {Array|Action} array of actions
 */
cc.Race = cc.ActionInterval.extend({
    _actions:null,

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
        for(var i = 0; i < this._actions.length; i++) {
            this._actions[i].startWithTarget(this._target);
        }
    },

    stop:function () {
        for(var i = 0; i < this._actions.length; i++) {
            this._actions[i].stop();
        }
        this._isDone = true;
        cc.Action.prototype.stop.call(this);
    },

    step:function (dt) {
        var locActions = this._actions;
        for(var i = 0; i < locActions.length; i++) {
            var a = locActions[i];
            a.step(dt);
            if(a.isDone()) {
                this.stop()
                return;
            }
        }
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
 * Runs actions in parallel, but when one of them isDone(), stops all others and is considered done
 * @class Race
 * @extends ActionInterval
 * @param {Array|Action} array of actions
 */
cc.race = function (actions) {
    return new cc.Race((actions instanceof Array) ? actions : arguments);
};