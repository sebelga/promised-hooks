'use strict';

class MyClass{
    save() {
        return new Promise((resolve, reject) => {
            resolve('1234');
        });
    }
};

module.exports = MyClass;
