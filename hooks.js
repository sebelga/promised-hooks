
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
            const pres = this.__pres[name] || this.prototype.__pres[name];

            /**
             * Array of post hooks
             */
            const posts = this.__posts[name] || this.prototype.__posts[name];

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
                const next = function next() {
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

                    if (args && args.length && typeof args[0] !== 'undefined') {
                        hookArgs = args;
                    }

                    if (currentPre + 1 < totalPres) {
                        currentPre += 1;
                        currentHook = pres[currentPre];

                        return currentHook.apply(scope, hookArgs).then(next, handleError);
                    }

                    // hookArgs.push(resolve);
                    return done.apply(scope, hookArgs);
                };

                return next.apply(this, passedArgs);
            });

            function done() {
                const args = Array.prototype.slice.apply(arguments);

                resolveFn = resolveFn || Promise.resolve;
                rejectFn = rejectFn || Promise.reject;

                let currentPost = -1;

                const next = function next(data) {
                    if (currentPost + 1 < totalPost && self.__hooksEnabled !== false) {
                        currentPost += 1;
                        /**
                         * Reference to current post hook
                         */
                        const currPost = posts[currentPost];

                        // Call next "post" hook
                        return currPost.call(scope, data).then(next, (err) => {
                            // we convert response to object
                            if (!is.object(data)) {
                                data = {
                                    result: data,
                                };
                            }

                            // create errors Array
                            data.errorsPostHook = data.errorsPostHook || [];
                            data.errorsPostHook.push(err);

                            return next(data);
                        });
                    }

                    // Resolve... we're done! :)
                    return resolveFn(data);
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
