'use strict';

class MyClass{
    save() {
        return new Promise((resolve, reject) => {
            resolve('1234');
        });
    }
};

class MyOtherClass{
    save() {
        return new Promise((resolve, reject) => {
            resolve({ data: [1, 2, 3] });
        });
    }
};

module.exports = {
    MyClass,
    MyOtherClass
};
