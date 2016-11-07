'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
require('sinon-as-promised');

const hooks = require('../index');
const Model = require('../mocks/model.mock');

describe('hooks-promise', () => {
    let model;
    let _hooks = {
        hook: hooks.hook,
        pre: hooks.pre,
        post: hooks.post,
        _lazySetupHooks: hooks._lazySetupHooks
    };
    beforeEach(() => {
        model = new Model();

        Object.keys(_hooks).forEach((k) => {
            model[k] = _hooks[k];
        });
    });

    describe('pre()', () => {
        let spyPre1, spyPre2, spyOriginalMethod;
        let error = {
            code: 500
        };

        let spies = {
            preHook1: function() {
                this.newValue = 123;
                return Promise.resolve();
            },
            preHook2: function() {
                return Promise.resolve();
            }
        };

        beforeEach(() => {
            spyPre1 = sinon.spy(spies, 'preHook1');
            spyPre2 = sinon.spy(spies, 'preHook2');
            spyOriginalMethod = sinon.spy(model.__proto__, 'save');

            model.pre('save', spies.preHook1);
            model.pre('save', spies.preHook2);
        });

        afterEach(() => {
            spyPre1.restore();
            spyPre2.restore();
            spyOriginalMethod.restore();
        });

        it('should execute pre hooks in correct order', () => {
            return model.save().then(() => {
                sinon.assert.callOrder(spyPre1, spyPre2, spyOriginalMethod);
            });
        });

        it('should pass the correct scope to the hook', () => {
            return model.save().then(() => {
                expect(model.newValue).equal(123);
            });
        });

        it('should catch errors in hooks and not call the original method', () => {
            model.pre('save', function() {
                return Promise.reject(error);
            });

            return model.save().catch((err) => {
                expect(err).equal(error);
                expect(spyOriginalMethod.called).be.false;

                // Remove this last preHook1 (to stop throwing error);
                model.__proto__.__pres.save.pop();
            });
        });

        it('should pass parameter to originalMethod', () => {
            const args = ['abc', 123];
            return model.save(...args).then(() => {
                expect(spyOriginalMethod.getCall(0).args).deep.equal(args);
            });
        });

        it('preHook resolve should override original parameter passed', () => {
            model.pre('save', function() {
                return Promise.resolve(['newParam1', 'newParam2']);
            });
            return model.save(123, 'abc').then(() => {
                expect(spyOriginalMethod.getCall(0).args).deep.equal(['newParam1', 'newParam2']);
            });
        });

        it('should work with methods from an object', () => {
            let modelObject = {
                save: function() { return Promise.resolve(); },
                test1: function() {}
            };

            Object.keys(_hooks).forEach((k) => {
                modelObject[k] = _hooks[k];
            });

            spyOriginalMethod = sinon.spy(modelObject, 'save');
            modelObject.pre('save', spies.preHook1);
            modelObject.pre('save', spies.preHook2);

            return modelObject.save().then(() => {
                sinon.assert.callOrder(spyPre1, spyPre2, spyOriginalMethod);
            });
        });
    });

    describe('post()', () => {
        let spyPost1, spyPost2, spyOriginalMethod;
        let error = {
            code: 500
        };

        let spies = {
            postHook1: function(result) {
                this.newValue = 456;
                return Promise.resolve(result);
            },
            postHook2: function(result) {
                return Promise.resolve(result);
            }
        };

        beforeEach(() => {
            spyPost1 = sinon.spy(spies, 'postHook1');
            spyPost2 = sinon.spy(spies, 'postHook2');
            spyOriginalMethod = sinon.spy(model.__proto__, 'save');

            model.post('save', spies.postHook1);
            model.post('save', spies.postHook2);
        });

        afterEach(() => {
            spyPost1.restore();
            spyPost2.restore();
            spyOriginalMethod.restore();
        });

        it('should execute posts hooks in correct order', () => {
            return model.save().then(() => {
                sinon.assert.callOrder(spyOriginalMethod, spyPost1, spyPost2);
            });
        });

        it('should pass the correct scope to the hook', () => {
            return model.save().then(() => {
                expect(model.newValue).equal(456);
            });
        });

        it('should pass resolve value from originalMethod response', () => {
            return model.save().then((response) => {
                expect(response).equal('1234');
            });
        });

        it('should override original resolve in post hooks', () => {
            model.post('save', function() {
                return Promise.resolve('5678');
            });

            return model.save().then((response) => {
                expect(response).deep.equal('5678');
            });
        });

        it('should work with methods from an object', () => {
            let modelObject = {
                save: function() { return Promise.resolve(); },
                test1: function() {}
            };

            Object.keys(_hooks).forEach((k) => {
                modelObject[k] = _hooks[k];
            });

            spyOriginalMethod = sinon.spy(modelObject, 'save');
            modelObject.post('save', spies.postHook1);
            modelObject.post('save', spies.postHook2);

            return modelObject.save().then(() => {
                sinon.assert.callOrder(spyOriginalMethod, spyPost1, spyPost2);
            });
        });
    });
});