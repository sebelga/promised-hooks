/* eslint-disable no-multi-assign */

'use strict';

const is = require('is');
const arrify = require('arrify');

const ERR_KEY = Symbol('errors');

class HooksPromise {
  static wrap(scope) {
    scope.pre = this.pre;
    scope.post = this.post;
    scope.hook = this.hook;
    scope.__setupHooks = this.__setupHooks;
  }

  static hook(name, originalMethod) {
    const proto = this;

    const presHooks = (proto.__pres = proto.__pres || {});
    const postsHooks = (proto.__posts = proto.__posts || {});

    presHooks[name] = presHooks[name] || [];
    postsHooks[name] = postsHooks[name] || [];

    /**
     * Wrap the original "target" method with hooks
     */
    proto[name] = function wrapper() {
      const self = this;

      /**
       * save the arguments passed to the target method
       */
      let passedArgs = Array.prototype.slice.apply(arguments);

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
      let scope = self;

      /**
       * Current hook being processed
       */
      let currentPre = -1;

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
         * "pre" hook handler
         */
        const nextPreHook = function nextPreHook() {
          /**
           * read the arguments from previous "hook" response
           */
          const args = Array.prototype.slice.apply(arguments);

          /**
           * Check if the arguments contains an "__override" property
           * that would override the arguments sent originally to the
           * target method
           */
          if (
            is.object(args[0])
            && {}.hasOwnProperty.call(args[0], '__override')
          ) {
            passedArgs = arrify(args[0].__override);
          }

          /**
           * Reference to current pre hook
           */
          let currentHook;

          if (currentPre + 1 < totalPres) {
            currentPre += 1;
            currentHook = pres[currentPre];
            const hookMethod = currentHook.displayName || currentHook.name;
            /**
             * If there is a __scopeHook function on the object
             * we call it to get the scope wanted for the hook
             */
            scope = getScope(self, name, passedArgs, hookMethod, 'pre');

            /**
             * Execute the hook and recursively call the next one
             */
            return currentHook
              .apply(scope, passedArgs)
              .then(nextPreHook, handleError);
          }

          /**
           * We are done with "pre" hooks
           */
          return done.apply(scope, passedArgs);
        };

        return nextPreHook.apply(this, passedArgs);
      });

      function done() {
        /**
         * In case we "skipped" the "pre" hooks we define our resolve function
         */
        resolveFn = resolveFn
          || function resolve(data) {
            return Promise.resolve(data);
          };

        let response;
        let currentPost = -1;

        /**
         * "post" hook handler
         * @param {*} res the response coming from the target method
         * or the reponse from any "post" hook
         */
        const nextPostHook = function nextPostHook(res) {
          response = checkResponse(res, response);

          if (currentPost + 1 < totalPost && self.__hooksEnabled !== false) {
            currentPost += 1;

            // Reference to current post hook
            const currPost = posts[currentPost];
            const hookMethod = currPost.displayName || currPost.name;
            scope = getScope(self, name, res, hookMethod, 'post');

            // Recursively call all the "post" hooks
            return currPost
              .call(scope, response)
              .then(nextPostHook, postHookErrorHandler);
          }

          /**
           * All "post" hook process done.
           * If the response has an "__override" property it will be our response
           */
          if (
            is.object(response)
            && {}.hasOwnProperty.call(response, '__override')
          ) {
            response = response.__override;
          }

          return resolveFn(response);
        };

        /**
         * "post" hook Error handling
         * @param {*} err the error returned by latest "post" hook
         */
        function postHookErrorHandler(err) {
          /**
           * Helper to add an error to an Object "errors" Symbol
           */
          const addError = (obj) => {
            obj[ERR_KEY] = obj[ERR_KEY] || [];
            obj[ERR_KEY].push(err);
            return obj;
          };

          /**
           * For response type that are *not* objects (string, integers, functions...)
           * we convert the response to an object with a "result" property and set it as "override"
           */
          if (typeof response !== 'object') {
            response = {
              __override: {
                result: response,
              },
            };
          }

          if ({}.hasOwnProperty.call(response, '__override')) {
            response.__override = addError(response.__override);
          } else {
            response = addError(response);
          }

          return nextPostHook(response);
        }

        /**
         * Get the target method response
         */
        let responsePromised;
        try {
          responsePromised = originalMethod.apply(self, passedArgs);
        } catch (e) {
          responsePromised = Promise.reject(e);
        }

        /**
         * Convert it to a Promise if it is not to be able to chain it
         */
        if (responsePromised.constructor.name !== 'Promise') {
          responsePromised = Promise.resolve(responsePromised);
        }

        /**
         * If there are post hooks, we chain the response with the hook
         */
        if (totalPost > 0) {
          return responsePromised.then(nextPostHook, rejectFn);
        }

        // no "post" hook, we're done!
        return responsePromised.then(resolveFn, rejectFn);
      }

      function checkResponse(currentResponse, previousResponse) {
        if (!previousResponse) {
          return currentResponse;
        }

        if (
          is.object(currentResponse)
          && {}.hasOwnProperty.call(currentResponse, '__override')
        ) {
          const isObject = is.object(previousResponse);
          const hasOverride = isObject && {}.hasOwnProperty.call(previousResponse, '__override');
          const hasErrorsPostHooks = hasOverride
            && typeof previousResponse.__override[ERR_KEY] !== 'undefined';

          if (isObject && hasOverride && hasErrorsPostHooks) {
            if (typeof currentResponse.__override !== 'object') {
              currentResponse.__override = {
                result: currentResponse.__override,
              };
            }

            /**
             * We add the previous "post" hooks error to the
             * current response
             */
            currentResponse.__override[ERR_KEY] = previousResponse.__override[ERR_KEY];
          }
          return currentResponse;
        }

        return previousResponse;
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

    const pres = (proto.__pres = proto.__pres || {});

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

    const posts = (proto.__posts = proto.__posts || {});

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

HooksPromise.ERRORS = ERR_KEY;

// Helpers
/**
 * Set the scope (this) for the hook callback at runtime.
 * The wrapped object/Class need to have a __scopeHook method declared that will return the scope
 * wanted for each hook.
 *
 * @param {*} self Scope of the wrapped object
 * @param {*} hookName Name of the hook (the target method on the object/class)
 * @param {*} args The arguments passed to the target method
 * @param {*} hookMethod The name of the callback function (if not an anonymous function of course)
 * @param {*} hookType The hook type: "pre" or "post"
 */
function getScope(self, hookName, args, hookMethod, hookType) {
  return self.__scopeHook && typeof self.__scopeHook === 'function'
    ? self.__scopeHook(hookName, args, hookMethod, hookType)
    : self;
}

module.exports = HooksPromise;
