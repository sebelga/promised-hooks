// ************ Your package ************
const { hooks } = require('promised-hooks');

const api = {
    doSomethingGreat() {
        return Promise.resolve({ data: 123 });
    },
};

hooks.wrap(api);
module.exports = api;

// *********** CONSUMERS of your package ********
const { AmazingService } = require('your-package');

// Add a middleware to be executed *before* doSomethingGreat()
// to authorize the method call
AmazingService.pre('doSomethingGreat', function() {
    return someService.checkIfDoSomethingGreatAllowed();
});

// ...

// Anywhere in the Application, the hook will authorize the method call
async function someHandler() {
    let res;
    try {
        res = await AmazingService.doSomethingGreat();
    } catch(e) {
        // not allowed
    }
}