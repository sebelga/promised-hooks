'use strict';

const chai = require('chai');
const sinon = require('sinon');
const hooks = require('../index');
const mocks = require('../mocks/model.mock');

const expect = chai.expect;
const Model = mocks.MyClass;
const Model2 = mocks.MyOtherClass;
require('sinon-as-promised');

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
            model = new Model();
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
            model = new Model();
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
            return model.save({ abc: 777 }).then(() => {
                expect(spyOriginalMethod.getCall(0).args[0].abc).equal(777);
            });
        });

        it('preHook resolve should override original parameter passed', () => {
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

        it('bypass middleware(s) and catch post hook errors', () => {
            const e = { code: 501 };
            model.preHooksEnabled = false;
            model.post('save', () => Promise.reject(e));
            return model.save('abc', 123).then((data) => {
                expect(data.errorsPostHook[0]).equal(e);
            });
        });

        it('override the middleware scope', () => {
            const obj = { x: 1 };
            model = new Model();
            model.__scopeHook = function setScope() {
                return obj;
            };
            hooks.wrap(model);

            model.pre('save', function preHook() {
                expect(this).equal(obj);
                return Promise.resolve();
            });

            return model.save();
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
            model = new Model();
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
            model = new Model();
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

        it('should pass resolve value from originalMethod response', () => model.save().then((response) => {
            expect(response).equal('1234');
        }));

        it('should override original resolve in post hooks', () => {
            model.post('save', () => Promise.resolve('5678'));

            return model.save().then((response) => {
                expect(response).equal('5678');
            });
        });

        it('should not reject promise on error', () => {
            model.post('save', () => Promise.reject({ code: 500 }));

            model.post('save', data => Promise.resolve(data));

            return model.save().then((response) => {
                expect(response).deep.equal({
                    result: '1234',
                    errorsPostHook: [{ code: 500 }],
                });
            });
        });

        it('should not create object if response is already one', () => {
            model = new Model2();
            hooks.wrap(model);

            model.post('save', () => Promise.reject({ code: 500 }));

            model.post('save', data => Promise.resolve(data));

            return model.save().then((response) => {
                expect(response).deep.equal({
                    data: [1, 2, 3],
                    errorsPostHook: [{ code: 500 }],
                });
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

        it('should convert original to Promise', () => {
            model = new Model();
            const spy = { original: () => true };
            const spyOriginal = sinon.spy(spy, 'original');
            sinon.stub(model, 'save', () => spy.original());

            hooks.wrap(model);
            model.post('save', [spyPost1, spyPost2]);

            return model.save().then(() => {
                sinon.assert.callOrder(spyOriginal, spyPost1, spyPost2);
            });
        });
    });
});
