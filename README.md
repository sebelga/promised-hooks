# Middleware "pre" & "post" hooks for Promises

Add middelwares to execute **before** and **after** your Promises.

[![npm version](https://badge.fury.io/js/promised-hooks.svg)](https://badge.fury.io/js/promised-hooks) [![Build Status](https://travis-ci.org/sebelga/promised-hooks.svg?branch=master)](https://travis-ci.org/sebelga/promised-hooks) 
[![Coverage Status](https://coveralls.io/repos/github/sebelga/promised-hooks/badge.svg?branch=master)](https://coveralls.io/github/sebelga/promised-hooks?branch=master)

## Getting started

First **install the package**

`npm install promised-hooks --save`

Then **wrap your Class or Object** to add hooks methods to them.

```js
const hooks = require('promised-hooks');

// -------
// Class
// -------
class User {
	// some method that returns a Promise
	someMethod() { ... }
}

// or the ES5 may
function User() {
}
User.prototype.someMethod = function someMethod() { ... }

// wrap it!
hooks.wrap(User);

// Object
var api = {
	save: function() { ... }
};
hooks.wrap(api);

```

## Add middleware



### pre() method

Adds a middelware to a promise that will be resolved or rejected **before** the method you are targetting. If the middelware rejects the Promise the original method is **not executed**.
All the parameters sent to the original methods are available in the arguments of your middleware. You can modifiy them and pass an Array with the new arguments in your resolve.


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

### post() method
Adds a middelware to be executed when the method you are targetting is **resolved**. If the post middleware fails and rejects the Promise, the original Promise still resolves and a the response is converted to an object with 2 properties.  

- result (the result from the targeted method)
- errorsPostHook <Array> (an array with the errors from any "post" middleware)

If you resolve your post middelware with any data it **will override** the original response.

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
    // If you resolve here with another value you override this response
    
    // do something great synchroneously
    // ....
    
    // then simply return a resolve
    return Promise.resolve();
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

// Class
class User {
	save(userData) {
		return new Promise((resolve, reject) {
			...your logic to save a user then
			resolve(response);
		});
	}
	
	// works also on static methods
	static otherMethod() { ... }
}
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
	
	// You don't need to pass anything to resolve, original
	// parameters are forwarded
	return Promise.resolve();
	
	// ----------

	function hashString(str) {
		... logic to hash a string
		return hashedString;
	}
});

// Send an email maybe
User.post('save', (response) => {
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
		// Check if errors in post middleware
		if (response.hasOwnProperty('errorsPostHook')) {
			// deal with Post hook error
		}
		
		...
		
	}, (err) => {
		// Save failed
		// something went wrong...
	});

```

## Credits
I have been inspired by the [hooks-fixed](https://github.com/vkarpov15/hooks-fixed) library from @vkarpov15 to write this small utility.
