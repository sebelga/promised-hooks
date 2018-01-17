# Middleware "pre" & "post" hooks for Promises

Add middelwares to execute **before** and **after** your Promises.

[![npm version](https://badge.fury.io/js/promised-hooks.svg)](https://badge.fury.io/js/promised-hooks) [![Build Status](https://travis-ci.org/sebelga/promised-hooks.svg?branch=master)](https://travis-ci.org/sebelga/promised-hooks) 
[![Coverage Status](https://coveralls.io/repos/github/sebelga/promised-hooks/badge.svg?branch=master)](https://coveralls.io/github/sebelga/promised-hooks?branch=master)

## Getting started

First **install the package**

```sh
yarn add promised-hooks
# or
npm install promised-hooks --save`
```


Then **wrap your Class or Object** to add hooks methods to them.

```js
const hooks = require('promised-hooks');

// apply it on a Class
class User {
    // some method that returns a Promise
    someMethod() { ... }
}

// or the ES5 may
function User() {
}
User.prototype.someMethod = function someMethod() { ... }

// ... or on an object
const api = {
    save: function() { ... }
};

// Then wrap it to add "pre" and "post" hooks functionalities
hooks.wrap(User);
hooks.wrap(api);

```

## Add middleware

### pre() method

Adds a middelware to a promise that will be resolved or rejected **before** the method you are targetting. If the middelware rejects the Promise the original method is **not executed**.
All the parameters sent to the original methods are available in the arguments of your middleware.  


```js
class User {
	// instance methods
	save() { ... }

	// works also with static methods
	static otherMethod() { ... }
}

User.pre('save', doSometingBeforeSaving);

function doSometingBeforeSaving()  {
	// the scope (this) is the original Object wrapped

	// Access arguments passed
	const args = Array.prototype.slice.apply(arguments);

	// You could modify/validate them and pass them back in the resolve()
	// ...

	// must return a Promise
	return new Promise((resolve, reject) => {

		// ... do some cool stuff then
		resolve(); // or reject()
	});
}

```

#### Override
You can override the original arguments sent to the target method by resolving the middleware with an object containing an "__override" property.

```js
User.pre('save', doSometingBeforeSaving);

function doSometingBeforeSaving()  {
	return new Promise((resolve, reject) => {
        // call some api or any async stuff
        // ...

        resolve({ __override: 123 }); // single argument
        // or
        resolve({ __override: [ 123, 'something else' ] }); // multi arguments
    });

    /**
     * With the above override, the User.save() method will then
     * receive those arguments instead of the one originally provided
     */
}

```

### post() method
Adds a middelware to be executed when the method you are targetting is **resolved**. If the post middleware fails and rejects the Promise, the original Promise still resolves but the response is converted to an object with 2 properties.  

- result (the result from the targeted method)
- errorsPostHook <Array> (an array with the errors from any "post" middleware)

If you resolve your post middelware with an object containing an "__override" property (same as with "pre" hook), it **will override** the original response.

```js
class User {
	// instance methods
	save() { ... }

	// works also with static (prototype) methods
	static otherMethod() { ... }
}

User.post('save', postMiddleware1);
User.post('save', postMiddleware2);

function postMiddleware1(data) {
    // data is the resolved value from the original promised method.

    // do some async stuff
    // ....

    // then simply return a resolve
    return Promise.resolve();

    // or override the response
    return Promise.resolve({ __override: 'my new response' });
}

function postMiddleware2(data) {
    return new Promise((resolve, reject) => {
    	// do something async stuff
    	myApi.doSomething((err) => {
			if (err) {
				/* if the async fails you would then reject your promise.
				 * The original response (data) will *not* be overriden
				 * but will be converted to an object with 2 properties:
				 * {result, errorsPostHook}
				*/
				return reject(err);
			}

			// no error
			return resolve();
    	});
    });
}

```

## Example

```js
const hooks = require('promised-hooks');

class User {
    save(userData) {
        return new Promise((resolve, reject) {
            // ...your logic to save a user then
            resolve(response);
        });
    }

    // works also on static methods
    static otherMethod() { ... }
}

// Wrap the class to add hooks functionalities
hooks.wrap(User);

// Hash a user password before saving
User.pre('save', (userData) => {
	/**
	 * INFO: If you want to access the User class from this middelware
	 * you can not use an arrow function as the scope is lost.
	 * Just use a normal function and *this* will be your Class
	*/

	if (typeof userData.password !== 'undefined') {
		userData.password = hashString(userData.password);
	}

	return Promise.resolve();

	// ----------

	function hashString(str) {
		// ... logic to hash a string
		return hashedString;
	}
});

// Send an email maybe
User.post('save', (response) => {
    // response is what the target method returns
	const email = response.email;

	// Return a method that returns a Promise
	return yourMailService.sendEmail(email);
});

// Create new user
const user = new User();

// Save user
user.save({ name: 'John', password: 'snow' })
	.then((response) => {
        // Save success

        // Check if there are any errors in our "post" middleware
		if (response.hasOwnProperty('errorsPostHook')) {
			// deal with Post hook error
		}

	}, (err) => {
		// Save failed
	});

```

## Credits
I have been inspired by the [hooks-fixed](https://github.com/vkarpov15/hooks-fixed) library from @vkarpov15 to write this small utility.
