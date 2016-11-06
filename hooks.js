
'use strict';

const is = require('is');

class HooksPromise {
    hook(name, originalMethod) {
            const proto = this.__proto__ || this.prototype || this;
            const pres = proto.__pres = proto.__pres || {};
            const posts = proto.__posts = proto.__posts || {};

            pres[name] = pres[name] || [];
            posts[name] = posts[name] || [];

            // We wrapp the original method with he hooked logig
            proto[name] = function(...passedArgs) {
                const self = this;

                const lastArg = arguments[arguments.length-1];

                /**
                 * Array or pre hooks
                 */
                const pres = this.__pres[name];

                /**
                 * Array of post hooks
                 */
                // const posts = this.__posts[name];

                /**
                 * Total pre hooks
                 */
                const totalPres = pres.length;

                /**
                 * Current hook being processed
                 */
                let currentPre = -1;

                /**
                 * arguments eventually passed to the hook - are mutable
                 */
                let hookArgs;

                /**
                 * Total async method still to execute
                 */
                let asyncsLeft = proto[name].__numAsyncPres;

                return new Promise(function(resolve, reject) {
                    /**
                     * Handler when an async method is done processing
                     */
                    const asyncsDone = function(err) {
                        if (err) {
                            return handleError(err);
                        }

                        if (asyncsLeft-- === 0) {

                            _done.apply(self, hookArgs);
                        }
                    };

                    /**
                     * Error Handler
                     */
                    const handleError = function(err) {
                        reject(err);
                    };

                    /**
                     * Middleware (hook) wrapper
                     */
                    const next = function (...args) {
                        /**
                         * Reference to current pre hook
                         */
                        let currentHook;
                        let preArgs;

                        if (args && args.length && typeof args[0] !== 'undefined') {
                            hookArgs = args;
                        };

                        if (++currentPre < totalPres) {
                            currentHook = pres[currentPre]

                            return currentHook.apply(self, hookArgs).then(next, handleError);
                        } else if (!asyncsLeft) {
                            return done.apply(self, hookArgs);
                        }
                    }

                    const done = function (...args) {
                        if (is.array(args[0]) && args.length === 1) {
                            args = args[0];
                        }

                        /**
                         * Array or posts hooks for this method (name)
                         */
                        const posts = this.__posts[name];

                        let response;
                        let totalPost = posts.length;
                        let currentPost = -1;
                        let postArgs;

                        if (currentPre === totalPres) {

                            let next = function (response) {
                                /**
                                 * Reference to current post hook
                                 */
                                let currPost;
                                let postArgs;

                                if (++currentPost < totalPost) {
                                    currPost = posts[currentPost];

                                    // Call next "post" hook
                                    return currPost.call(self, response).then(next, handleError);
                                } else {
                                    // Resolve... we're done! :)
                                    return resolve(response);
                                }
                            };

                            // We are assuming that if the last argument provided to the wrapped function is a function, it was expecting
                            // a callback.  We trap that callback and wait to call it until all post handlers have finished.
                            if(typeof lastArg === 'function'){
                                args[args.length - 1] = once(next);
                            }

                            // We execute the actual (original) method
                            response = originalMethod.apply(self, args);

                            // We either return a 'post' hook
                            if (totalPost > 0) {
                                return response.then(next, handleError);
                            }

                            // no "post" hook, we're done!
                            return response.then(resolve, handleError);
                        } else {
                            // This should never happen
                            // Reject and show message.
                            reject({
                                message: 'Hook promise problem. Please raise an issue'
                            });
                        }
                    };

                    return next.apply(this, passedArgs);
                });
            };

            proto[name].__numAsyncPres = 0;
            proto[name].__hooked = true;

            return this;
    }

    pre(name, isAsync, fn) {
        if ('boolean' !== typeof arguments[1]) {
            fn = isAsync;
            isAsync = false;
        }

        const proto = this.__proto__ || this.prototype || this;
        const pres = proto.__pres = proto.__pres || {};

        this._lazySetupHooks(proto, name);

        fn.__isAsync = isAsync;

        if (isAsync) {
            proto[name].__numAsyncPres++;
        }

        if (typeof pres[name] === 'undefined') {
            pres[name] = [];
        }

        pres[name].push(fn);

        return this;
    }

    post(name, fn) {
        const proto = this.__proto__ || this.prototype || this;
        const posts = proto.__posts = proto.__posts || {};

        this._lazySetupHooks(proto, name);

        if (typeof posts[name] === 'undefined') {
            posts[name] = [];
        }

        posts[name].push(fn);

        return this;
    }

    _lazySetupHooks(proto, methodName) {
        if (proto[methodName].__hooked !== true) {
            this.hook(methodName, proto[methodName]);
        }
    }
}

module.exports = new HooksPromise();
