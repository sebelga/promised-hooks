
'use strict';

const is = require('is');
const arrify = require('arrify');

class HooksPromise {
    static wrap(scope) {
        scope.pre = this.pre;
        scope.post = this.post;
        scope.hook = this.hook;
        scope.__setupHooks = this.__setupHooks;
    }

    static hook(name, originalMethod) {
        const proto = this;

        const presHooks = proto.__pres = proto.__pres || {};
        const postsHooks = proto.__posts = proto.__posts || {};

        presHooks[name] = presHooks[name] || [];
        postsHooks[name] = postsHooks[name] || [];

        // We wrapp the original method with he hooked logig
        proto[name] = function wrapper() {
            const passedArgs = Array.prototype.slice.apply(arguments);
            const self = this;

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

            return new Promise((resolve, reject) => {
                resolveFn = resolve;
                rejectFn = reject;

                /**
                 * Error Handler
                 */
                const handleError = function handleError(err) {
                    reject(err);
                };

                /**
                 * Middleware (hook) wrapper
                 */
                const nextPreHook = function nextPreHook() {
                    let args = Array.prototype.slice.apply(arguments);

                    /**
                     * If the current hook is overwriting the arguments
                     * of the original method
                     */
                    let override = false;

                    if (is.object(args[0]) && {}.hasOwnProperty.call(args[0], '__override')) {
                        args = arrify(args[0].__override);
                        override = true;
                    }

                    // If there is a __scopeHook function on the object
                    // we call it to get the scope wanted for the hook
                    scope = getScope(self, name, args);

                    /**
                     * Reference to current pre hook
                     */
                    let currentHook;

                    hookArgs = override ? args : passedArgs;

                    if (currentPre + 1 < totalPres) {
                        currentPre += 1;
                        currentHook = pres[currentPre];

                        return currentHook.apply(scope, hookArgs).then(nextPreHook, handleError);
                    }

                    return done.apply(scope, hookArgs);
                };

                return nextPreHook.apply(this, passedArgs);
            });

            function done() {
                const targetMethodArgs = Array.prototype.slice.apply(arguments);

                resolveFn = resolveFn || function resolve(data) { return Promise.resolve(data); };

                let targetMethodResponse;
                let currentPost = -1;

                const nextPostHook = function nextPostHook(res) {
                    // we save the target method response
                    targetMethodResponse = targetMethodResponse || res;

                    const { arg, override } = parsePostArgs(res, targetMethodResponse);
                    const hookArg = override ? arg : targetMethodResponse;

                    targetMethodResponse = hookArg;

                    if (currentPost + 1 < totalPost && self.__hooksEnabled !== false) {
                        /**
                         * Recursively call all the post hooks
                         */

                        currentPost += 1;

                        // Reference to current post hook
                        const currPost = posts[currentPost];

                        // Call nextPostHook
                        return currPost.call(scope, hookArg).then(nextPostHook, (err) => {
                            // ----------------------------
                            // Error handling
                            // ----------------------------
                            const resOverride = {
                                __override: {
                                    result: arg,
                                },
                            };

                            // create errors Array
                            resOverride.__override.errorsPostHook = resOverride.errorsPostHook || [];
                            resOverride.__override.errorsPostHook.push(err);

                            return nextPostHook(resOverride);
                        });
                    }

                    // Resolve... we're done! :)

                    let resolveResponse = hookArg;

                    if (is.object(hookArg) && {}.hasOwnProperty.call(hookArg, '__override')) {
                        resolveResponse = hookArg.__override;
                    }

                    return resolveFn(resolveResponse);
                };

                // We execute the actual (target) method
                let responsePromised = originalMethod.apply(self, targetMethodArgs);

                if (responsePromised.constructor.name !== 'Promise') {
                    // If the response from the target method is not a promise
                    // we convert it to a Promise
                    responsePromised = Promise.resolve(responsePromised);
                }

                // If there are post hooks, we chain the response with the hook
                if (totalPost > 0) {
                    return responsePromised.then(nextPostHook, rejectFn);
                }

                // no "post" hook, we're done!
                return responsePromised.then(resolveFn, rejectFn);
            }

            function parsePostArgs(_arg, originalResponse) {
                let arg = _arg;
                let override = false;

                if (is.object(arg) && {}.hasOwnProperty.call(arg, '__override')) {
                    arg = Object.assign({}, _arg);
                    override = true;

                    const isObject = is.object(originalResponse);
                    const hasOverride = isObject && {}.hasOwnProperty.call(originalResponse, '__override');
                    const hasErrorsPostHooks = hasOverride &&
                        {}.hasOwnProperty.call(originalResponse.__override, 'errorsPostHook');

                    if (isObject && hasOverride && hasErrorsPostHooks) {
                        // The response has been overriden in previous hook
                        if (is.object(arg.__override)) {
                            arg.__override.errorsPostHook = originalResponse.__override.errorsPostHook;
                        } else {
                            arg.__override = {
                                result: arg.__override,
                                errorsPostHook: originalResponse.__override.errorsPostHook,
                            };
                        }
                    }
                }

                return { arg, override };
            }
        };

        proto[name].__numAsyncPres = 0;
        proto[name].__hooked = true;

        return this;
    }

    static pre(name, fn) {
        const proto = this;

        if (is.array(fn)) {
            return fn.forEach((middleware) => {
                proto.pre.call(proto, name, middleware);
            });
        }

        const pres = proto.__pres = proto.__pres || {};

        proto.__setupHooks(proto, name);

        pres[name].push(fn);

        return proto;
    }

    static post(name, fn) {
        const proto = this;

        if (is.array(fn)) {
            return fn.forEach((middleware) => {
                proto.post.call(proto, name, middleware);
            });
        }

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
