'use strict';

module.exports = {
    getModel() {
        return {
            save: () => Promise.resolve('1234'),
            savePromise: () => new Promise((resolve) => {
                resolve('1234');
            }),
            saveReturnObject: () => Promise.resolve({ a: 123 }),
        };
    },
};
