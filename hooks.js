
'use strict';

const is = require('is');
const arrify = require('arrify');

class HooksPromise {
    static wrap(scope) {
        scope.pre = this.pre;
        scope.post = this.post;
        scope.hook = this.hook;
        scope.__setupHooks = this.__setupHooks
    };

    static hook(name, originalMethod) {
            let proto = this;
            // if (!proto.hasOwnProperty(name)) {
            //     proto = this;
            // }

            const pres = proto.__pres = proto.__pres || {};
            const posts = proto.__posts = proto.__posts || {};

            pres[name] = pres[name] || [];
            posts[name] = posts[name] || [];

            // We wrapp the original method with he hooked logig
            proto[name] = function() {
                const passedArgs = Array.prototype.slice.apply(arguments);
                const self = this;

                /**
                 * Array or pre hooks
                 */
                const pres = this.__pres[name] || this.__proto__.__pres[name];

                /**
                 * Array of post hooks
                 */
                const posts = this.__posts[name] || this.__proto__.__posts[name];;

                /**
                 * Total pre hooks
                 */
                const totalPres = pres.length;

                /**
                 * Total posts hooks
                 */
                const totalPost = posts.length;

                /**
                 * Scope for the hooks
                 */
                let scope;

                /**
                 * Current hook being processed
                 */
                let currentPre = -1;

                /**
                 * arguments eventually passed to the hook - are mutable
                 */
                let hookArgs;

                let resolveFn;
                let rejectFn;

                if (self.preHooksEnabled === false) {
                    return done.apply(self, passedArgs);
                }

                return new Promise(function(resolve, reject) {

                    resolveFn = resolve,
                    rejectFn = reject;

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
                        let args = Array.prototype.slice.apply(arguments);

                        if (is.object(args[0]) && {}.hasOwnProperty.call(args[0], '__override')) {
                            args = arrify(args[0].__override);
                        }

                        // If there is a __scopeHook function on the object
                        // we call it to get the scope wanted for the hook
                        scope = getScope(self, name, args);

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

                            return currentHook.apply(scope, hookArgs).then(next, handleError);
                        }

                        // hookArgs.push(resolve);
                        return done.apply(scope, hookArgs);
                    }

                    return next.apply(this, passedArgs);
                });

                function done () {
                    const args = Array.prototype.slice.apply(arguments);
                    // let callback;

                    // if (args.length > 0) {
                    //     const hasCallback = is.fn(args[args.length - 1]);

                    //     if (hasCallback) {
                    //         callback = args.pop();
                    //     }
                    // }

                    resolveFn = resolveFn || Promise.resolve;
                    rejectFn = rejectFn || Promise.reject;

                    let currentPost = -1;

                    let next = function (data) {
                        if (++currentPost < totalPost && self.__hooksEnabled !== false) {
                            /**
                             * Reference to current post hook
                             */
                            let currPost = posts[currentPost];

                            // Call next "post" hook
                            return currPost.call(scope, data).then(next, (err) => {
                                // we convert response to object
                                if(!is.object(data)) {
                                    data = {
                                        result: data
                                    };
                                }

                                // create errors Array
                                data.errorsPostHook = data.errorsPostHook || [];
                                data.errorsPostHook.push(err);

                                return next(data);
                            });
                        } else {
                            // Resolve... we're done! :)
                            return resolveFn(data);

                            // return resolve(data);
                        }
                    };

                    // We execute the actual (original) method
                    const response = originalMethod.apply(self, args);

                    // If there are post hooks, we chain the response with the hook
                    if (totalPost > 0) {
                        return response.then(next, rejectFn);
                    }

                    // no "post" hook, we're done!
                    if (response === true) {
                        return response;
                    }

                    return response.then(resolveFn, rejectFn);

                };

            };

            proto[name].__numAsyncPres = 0;
            proto[name].__hooked = true;

            return this;
    }

    static pre(name, fn) {
        let proto = this;
        // if (!proto.hasOwnProperty(name)) {
        //     proto = this;
        // }
        const pres = proto.__pres = proto.__pres || {};

        proto.__setupHooks(proto, name);

        pres[name].push(fn);

        return proto;
    }

    static post(name, fn) {
        let proto = this;
        // if (!proto.hasOwnProperty(name)) {
        //     proto = this;
        // }
        const posts = proto.__posts = proto.__posts || {};

        proto.__setupHooks(proto, name);

        posts[name].push(fn);

        return proto;
    }

    static __setupHooks(proto, methodName) {
        if (proto[methodName] && proto[methodName].__hooked !== true) {
            this.hook(methodName, proto[methodName]);
        }
    }
}

// Helpers
function getScope(self, hookName, args) {
    return self.__scopeHook &&
            typeof self.__scopeHook === 'function' &&
            typeof self.__scopeHook(hookName, args) !== 'undefined' ?
                self.__scopeHook(hookName, args) : self;
}

module.exports = HooksPromise;
