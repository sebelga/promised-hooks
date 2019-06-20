'use strict';

const chai = require('chai');
const sinon = require('sinon');
const hooks = require('../index');
const mocks = require('../mocks/model.mock');

const { expect } = chai;
const { getModel } = mocks;

describe('hooks-promise', () => {
    let model;

    describe('pre()', () => {
        let spyPre1;
        let spyPre2;
        let spyOriginalMethod;
        const error = {
            code: 500,
        };

        const spies = {
            preHook1() {
                this.newValue = 123;
                return Promise.resolve();
            },
            preHook2() {
                return Promise.resolve();
            },
        };

        beforeEach(() => {
            model = getModel();
            hooks.wrap(model);

            spyPre1 = sinon.spy(spies, 'preHook1');
            spyPre2 = sinon.spy(spies, 'preHook2');
            spyOriginalMethod = sinon.spy(model, 'save');

            model.pre('save', spies.preHook1);
            model.pre('save', spies.preHook2);
        });

        afterEach(() => {
            spyPre1.restore();
            spyPre2.restore();
            spyOriginalMethod.restore();
        });

        it('should execute pre hooks in correct order', () => model.save().then(() => {
            sinon.assert.callOrder(spyPre1, spyPre2, spyOriginalMethod);
        }));

        it('should allow an Array of middleware', () => {
            model = getModel();
            hooks.wrap(model);
            spyOriginalMethod = sinon.spy(model, 'save');
            model.pre('save', [spies.preHook1, spies.preHook2]);

            return model.save().then(() => {
                sinon.assert.callOrder(spyPre1, spyPre2, spyOriginalMethod);
            });
        });

        it('should pass the correct scope to the hook', () => model.save().then(() => {
            expect(model.newValue).equal(123);
        }));

        it('should catch errors in hooks and not call the original method', () => {
            model.pre('save', () => Promise.reject(error));

            return model.save().catch((err) => {
                expect(err).equal(error);
                expect(spyOriginalMethod.called).equal(false);
            });
        });

        it('should pass parameter to originalMethod', () => {
            const args = ['abc', 123];
            return model.save('abc', 123).then(() => {
                expect(spyOriginalMethod.getCall(0).args).deep.equal(args);
            });
        });

        it('preHook resolve should **not** override original parameter passed', () => {
            model.pre('save', () => Promise.resolve({ abc: 123 }));
            return model.save({ abc: 777 }).then((response) => {
                expect(response).equal('1234');
                expect(spyOriginalMethod.getCall(0).args[0].abc).equal(777);
            });
        });

        it('preHook resolve should override original parameter passed (multi)', () => {
            model.pre('save', () => Promise.resolve({ __override: ['newParam1', 'newParam2'] }));
            return model.save(123, 'abc').then(() => {
                expect(spyOriginalMethod.getCall(0).args).deep.equal(['newParam1', 'newParam2']);
            });
        });

        it('preHook resolve should override original parameter passed (single)', () => {
            model.pre('save', () => Promise.resolve({ __override: 'newParam1' }));
            return model.save(123, 'abc').then(() => {
                expect(spyOriginalMethod.getCall(0).args).deep.equal(['newParam1']);
            });
        });

        it('should work with methods from an object', () => {
            const myObject = {
                save() { return Promise.resolve(); },
                test1() { },
            };

            hooks.wrap(myObject);

            spyOriginalMethod = sinon.spy(myObject, 'save');
            myObject.pre('save', spies.preHook1);
            myObject.pre('save', spies.preHook2);

            return myObject.save().then(() => {
                sinon.assert.callOrder(spyPre1, spyPre2, spyOriginalMethod);
            });
        });

        it('bypass middleware(s)', () => {
            model.preHooksEnabled = false;
            return model.save('abc', 123).then(() => {
                expect(spyPre1.called).equal(false);
            });
        });

        it('override the middleware scope and pass the hook function name', () => {
            const scopePre = { x: 1 };
            const scopePost = { y: 2 };

            let check1;
            let check2;
            let scope1;
            let scope2;

            model = getModel();
            model.__scopeHook = function setScope(hookName, args, hookMethod, hookType) {
                if (hookName === 'save') {
                    check1 = hookMethod;
                } else if (hookName === 'delete' && hookType === 'pre') {
                    check2 = hookMethod;
                }

                return hookType === 'pre' ? scopePre : scopePost;
            };
            hooks.wrap(model);

            function myPreHookMethod() {
                scope1 = this;
                return Promise.resolve();
            }

            function myPostHookMethod() {
                scope2 = this;
                return Promise.resolve();
            }

            const myPreHookMethod2 = () => Promise.resolve();

            // We make sure that the hookMethod passed to __scopeHook
            // works with both functions and arrow functions
            model.pre('save', myPreHookMethod);
            model.pre('delete', myPreHookMethod2);
            model.post('delete', myPostHookMethod);

            return model.save()
                .then(() => model.delete())
                .then(() => {
                    expect(scope1).equal(scopePre);
                    expect(scope2).equal(scopePost);
                    expect(check1).equal('myPreHookMethod');
                    expect(check2).equal('myPreHookMethod2');
                });
        });

        it('should catch and reject thrown errors when the original method is not a promise', () => {
            model.pre('saveThrowError', spies.preHook2);
            return model.saveThrowError()
                .catch((err) => {
                    expect(err.message).equal('Thrown Error');
                });
        });
    });

    describe('post()', () => {
        let spyPost1;
        let spyPost2;
        let spyOriginalMethod;

        const spies = {
            postHook1(result) {
                this.newValue = 456;
                return Promise.resolve(result);
            },
            postHook2(result) {
                return Promise.resolve(result);
            },
        };

        beforeEach(() => {
            model = getModel();
            hooks.wrap(model);

            spyPost1 = sinon.spy(spies, 'postHook1');
            spyPost2 = sinon.spy(spies, 'postHook2');
            spyOriginalMethod = sinon.spy(model, 'save');

            model.post('save', spies.postHook1);
            model.post('save', spies.postHook2);
        });

        afterEach(() => {
            spyPost1.restore();
            spyPost2.restore();
            spyOriginalMethod.restore();
        });

        it('should execute posts hooks in correct order', () => model.save().then(() => {
            sinon.assert.callOrder(spyOriginalMethod, spyPost1, spyPost2);
        }));

        it('should allow an Array of middleware', () => {
            model = getModel();
            hooks.wrap(model);
            spyOriginalMethod = sinon.spy(model, 'save');
            model.post('save', [spyPost1, spyPost2]);

            return model.save().then(() => {
                sinon.assert.callOrder(spyOriginalMethod, spyPost1, spyPost2);
            });
        });

        it('should pass the correct scope to the hook', () => model.save().then(() => {
            expect(model.newValue).equal(456);
        }));

        it('should pass resolve value from originalMethod response', () => (
            model.save().then((response) => {
                expect(response).equal('1234');
            })
        ));

        it('should **not** override original resolve in post hooks', () => {
            model.post('savePromise', () => Promise.resolve('5678'));

            return model.savePromise().then((response) => {
                expect(response).equal('1234');
            });
        });

        it('should override original resolve in post hooks', () => {
            model.post('save', () => Promise.resolve({ __override: '5678' }));

            return model.save().then((response) => {
                expect(response).equal('5678');
            });
        });

        it('should not reject promise on error (error in "errorsPostHook")', () => {
            const error = { code: 500 };
            model.post('save', () => Promise.reject(error));

            return model.save().then((response) => {
                expect(response).deep.equal({
                    result: '1234',
                });
                expect(response[hooks.ERRORS][0]).equal(error);
            });
        });

        it('should not reject promise on error (error in Symbol)', () => {
            const error = { code: 500 };
            model.post('saveReturnObject', () => Promise.reject(error));

            return model.saveReturnObject().then((response) => {
                expect(response.a).equal(123);
                expect(response[hooks.ERRORS][0]).equal(error);
            });
        });

        it('should override response (1)', () => {
            const error = { code: 500 };
            model = getModel();
            hooks.wrap(model);

            model.post('save', () => Promise.reject(error));
            model.post('save', () => Promise.resolve({ __override: 'new response' }));

            return model.save().then((response) => {
                expect(response).deep.equal({
                    result: 'new response',
                });
                expect(response[hooks.ERRORS][0]).equal(error);
            });
        });

        it('should override response (2)', () => {
            model = getModel();
            hooks.wrap(model);
            const err = new Error();
            err.code = 501;

            model.post('save', () => Promise.resolve({ __override: { abc: 123 } }));
            model.post('save', () => Promise.reject(err));
            model.post('save', () => Promise.resolve({ __override: { abc: 456 } }));

            return model.save().then((response) => {
                expect(response.abc).equal(456);
                expect(response[hooks.ERRORS][0].code).equal(501);
            });
        });

        it('should work with methods from an object', () => {
            const myObject = {
                save() { return Promise.resolve(); },
                test1() { },
            };

            hooks.wrap(myObject);

            spyOriginalMethod = sinon.spy(myObject, 'save');
            myObject.post('save', spies.postHook1);
            myObject.post('save', spies.postHook2);

            return myObject.save().then(() => {
                sinon.assert.callOrder(spyOriginalMethod, spyPost1, spyPost2);
            });
        });

        it('should convert original target method response to a Promise', () => {
            model = getModel();
            const spy = { original: () => true };
            const spyOriginal = sinon.spy(spy, 'original');
            sinon.stub(model, 'save').returns(spy.original());

            hooks.wrap(model);
            model.post('save', [spyPost1, spyPost2]);

            return model.save().then(() => {
                sinon.assert.callOrder(spyOriginal, spyPost1, spyPost2);
            });
        });
    });
});
