'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
require('sinon-as-promised');

const hooks = require('../index');
const mocks = require('../mocks/model.mock');
const Model = mocks.MyClass;
const Model2 = mocks.MyOtherClass;

describe('hooks-promise', () => {
    let model;

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
            model = new Model();
            hooks.wrap(model);
            model.__proto__.__pres = {};

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
            });
        });

        it('should pass parameter to originalMethod', () => {
            const args = ['abc', 123];
            return model.save('abc', 123).then((argsPassed) => {
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
            let myObject = {
                save: function() { return Promise.resolve(); },
                test1: function() {}
            };

            hooks.wrap(myObject);

            spyOriginalMethod = sinon.spy(myObject, 'save');
            myObject.pre('save', spies.preHook1);
            myObject.pre('save', spies.preHook2);

            return myObject.save().then(() => {
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
            model = new Model();
            hooks.wrap(model);
            model.__proto__.__posts = {save: []};

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
                expect(response).equal('5678');
            });
        });

        it('should not reject promise on error', () => {
            model.post('save', function() {
                return Promise.reject({ code:500 });
            });

            model.post('save', function(data) {
                return Promise.resolve(data);
            });

            return model.save().then((response) => {
                expect(response).deep.equal({
                    result: '1234',
                    errorsPostHook: [{code: 500}]
                });
            });
        });

        it('should not create object if response is already one', () => {
            let model = new Model2();
            hooks.wrap(model);

            model.post('save', function() {
                return Promise.reject({ code:500 });
            });

            model.post('save', function(data) {
                return Promise.resolve(data);
            });

            return model.save().then((response) => {
                expect(response).deep.equal({
                    data: [1, 2, 3],
                    errorsPostHook: [{code: 500}]
                });
            });
        });

        it('should work with methods from an object', () => {
            let myObject = {
                save: function() { return Promise.resolve(); },
                test1: function() {}
            };

            hooks.wrap(myObject);

            spyOriginalMethod = sinon.spy(myObject, 'save');
            myObject.post('save', spies.postHook1);
            myObject.post('save', spies.postHook2);

            return myObject.save().then(() => {
                sinon.assert.callOrder(spyOriginalMethod, spyPost1, spyPost2);
            });
        });
    });
});