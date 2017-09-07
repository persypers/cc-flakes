/**
 * Similar to cc.callFunc, but the action is not done until it is explicitly .complete() 'ed
 * useful for converting asynchronous operations to cc.Action
 * 
 * Function will be called with first argument being this action.
 * Call :complete() for this action to be considered done.
 **/

cc.CallFuncAsync = cc.FiniteTimeAction.extend({
    _selectorTarget:null,
    _function:null,
    _data:null,

    /*
     * Constructor function, override it to extend the construction behavior, remember to call "this._super()" in the extended "ctor" function. <br />
	 * Creates a CallFuncAsync action with the callback.
	 * @param {function} selector
	 * @param {object|null} [selectorTarget] selector's "this" context
	 * @param {*|null} [data] data for function, it accepts all data types.
	 */
    ctor:function(selector, selectorTarget, data){
        cc.FiniteTimeAction.prototype.ctor.call(this);
        this.initWithFunction(selector, selectorTarget, data);
    },

    /*
     * Initializes the action with a function or function and its target
     * @param {function} selector
     * @param {object|Null} selectorTarget
     * @param {*|Null} [data] data for function, it accepts all data types.
     * @return {Boolean}
     */
    initWithFunction:function (selector, selectorTarget, data) {
        if (selector) {
            this._function = selector;
        }
        if (selectorTarget) {
            this._selectorTarget = selectorTarget;
        }
        if (data !== undefined) {
            this._data = data;
        }
        return true;
    },


    /*
     * execute the function.
     */
    step:function () {
        if (!this._isExecuted) {
            this._isExecuted = true;
            if(typeof(this._function) == "function") {
                this._function.call(this._selectorTarget, this, this._data);
            }
        }
    },
    
    update:function() {
        this.update();
    },
        
    clone:function(){
        var action = new cc.CallFuncAsync(this._function, this._selectorTarget, this._data);
        return action;
    },

    startWithTarget : function(target) {
        cc.Action.prototype.startWithTarget.call(this, target);
        this._isDone = false;
        this._isExecuted = false;
    },
    
    complete : function() {
        this._isDone = true;
    },
    
    isDone:function () {
        return this._isDone;
    },

});

cc.callFuncAsync = function(selector, selectorTarget, data) {
    return new cc.CallFuncAsync(selector, selectorTarget, data);
};