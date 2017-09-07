/*
 * Runs actions sequentially, one after another.
 * @class Sequence
 * @extends ActionInterval
 * @param {Array|Action} tempArray
 * @example
 * // create sequence with actions
 * var seq = new cc.Sequence(act1, act2);
 *
 * // create sequence with array
 * var seq = new cc.Sequence(actArray);
 */
cc.Sequence = cc.ActionInterval.extend({
    _actions:null,
    _last : -1,

    ctor:function (actions) {
        cc.ActionInterval.prototype.ctor.call(this);
        this.initWithActions(actions)
    },

    /*
     * Initializes the action <br/>
     * @param {FiniteTimeAction} actionOne
     * @param {FiniteTimeAction} actionTwo
     * @return {Boolean}
     */
    initWithActions:function (actions) {
        this._actions = actions;
        return true;
    },

    clone:function () {
        var action = new cc.Sequence();
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
        this._last = -1;
        this.nextAction();
    },

    stop:function () {
        var a = this._actions[this._last];
        a && a.stop();
        this._last = this._actions.length;
        cc.Action.prototype.stop.call(this);
    },

    nextAction : function() {
        this._last++;
        var a = this._actions[this._last];
        if(a) {
            a.startWithTarget(this._target);
        }
    },

    step:function (dt) {
        var a = this._actions[this._last];
        if(a) {
            a.step(dt);
            if(a.isDone()) this.nextAction();
        }
    },

    update:function(dt) {
        this.step(dt);
    },

    isDone : function() {
        return this._last >= this._actions.length;
    },

    reverse:function () {
        var action = new cc.Sequence();
        this._cloneDecoration(action);
        var actions = [];
        for(var i = 0; i < this._actions.length; i++)
            actions[this._actions.length - (i + 1)] = this._actions[i].clone();
        action.initWithActions(actions);
        return action;
    }
});

/*
 * Runs actions sequentially, one after another.
 * @class Sequence
 * @extends ActionInterval
 * @param {Array|Action} tempArray
 * @example
 * // create sequence with actions
 * var seq = cc.sequence(act1, act2);
 *
 * // create sequence with array
 * var seq = cc.sequence(actArray);
 */
cc.sequence = function (actions) {
    return new cc.Sequence((actions instanceof Array) ? actions : arguments);
};