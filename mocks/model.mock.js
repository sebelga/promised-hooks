'use strict';

class MyClass {
    save() {
        return Promise.resolve('1234');
    }
}

class MyOtherClass {
    save() {
        return Promise.resolve({ data: [1, 2, 3] });
    }
}

module.exports = {
    MyClass,
    MyOtherClass,
};
