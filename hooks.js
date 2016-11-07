
'use strict';

const is = require('is');

class HooksPromise {
    hook(name, originalMethod) {
            let proto = this.__proto__;
            if (!proto.hasOwnProperty(name)) {
                proto = this;
            }

            const pres = proto.__pres = proto.__pres || {};
            const posts = proto.__posts = proto.__posts || {};

            pres[name] = pres[name] || [];
            posts[name] = posts[name] || [];

            // We wrapp the original method with he hooked logig
            proto[name] = function() {
                const passedArgs = Array.prototype.slice.apply(arguments);
                const self = this;

                const lastArg = arguments[arguments.length-1];

                /**
                 * Array or pre hooks
                 */
                const pres = this.__pres[name];

                /**
                 * Array of post hooks
                 */
                const posts = this.__posts[name];

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
                     * Error Handler
                     */
                    const handleError = function(err) {
                        reject(err);
                    };

                    /**
                     * Middleware (hook) wrapper
                     */
                    const next = function () {
                        const args = Array.prototype.slice.apply(arguments);

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
                        }

                        return done.apply(self, hookArgs);
                    }

                    const done = function (...args) {
                        if (is.array(args[0]) && args.length === 1) {
                            args = args[0];
                        }

                        let response;
                        let totalPost = posts.length;
                        let currentPost = -1;
                        let postArgs;


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

                        // We execute the actual (original) method
                        response = originalMethod.apply(self, args);

                        // We either return a 'post' hook
                        if (totalPost > 0) {
                            return response.then(next, handleError);
                        }

                        // no "post" hook, we're done!
                        return response.then(resolve, handleError);
                    };

                    return next.apply(this, passedArgs);
                });
            };

            proto[name].__numAsyncPres = 0;
            proto[name].__hooked = true;

            return this;
    }

    pre(name, fn) {
        let proto = this.__proto__;
        if (!proto.hasOwnProperty(name)) {
            proto = this;
        }
        const pres = proto.__pres = proto.__pres || {};

        this._lazySetupHooks(proto, name);

        pres[name].push(fn);

        return this;
    }

    post(name, fn) {
        let proto = this.__proto__;
        if (!proto.hasOwnProperty(name)) {
            proto = this;
        }
        const posts = proto.__posts = proto.__posts || {};

        this._lazySetupHooks(proto, name);

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
