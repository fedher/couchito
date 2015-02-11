/**
 * Copyright (c) 2010 Nicholas C. Zakas. All rights reserved.
 *               2015 Modified by J. Federico Hernandez
 * MIT License
 */

function EventTarget() {
	this._listeners = {};	
};

EventTarget.prototype.constructor = EventTarget;

EventTarget.prototype.addListener = function (type, listener) {
	if (this._listeners[type] === undefined) {
		this._listeners[type] = [];
	}

	this._listeners[type].push(listener);
};

EventTarget.prototype.on = function (type, listener) {
	this.addListener(type, listener);
};

EventTarget.prototype.addListeners = function (config) {
	var type, listener;

	for (type in config) {
		listener = config[type];
		this.addListener(type, listener);
	}
};

EventTarget.prototype.dispatchEvent = function (event) {
	var listeners;
	var i;

	if (typeof event === 'string') {
		event = { type: event };
	}

	if (!event.target) {
		event.target = this;
	}

	if (!event.type) {
		throw new Error('Event object missing "type" property.');
	}

	if (this._listeners[event.type] instanceof Array) {
		listeners = this._listeners[event.type];
		for (i = 0; listeners[i]; i++) {
			listeners[i].call(this, event);
		}
	}
};

EventTarget.prototype.fireEvent = function (event) {
	this.dispatchEvent(event);
};

EventTarget.prototype.removeListener = function (type, listener) {
	var i;
	var listeners;

	if (this._listeners[type] instanceof Array) {
		listeners = this._listeners[type];
		for (i = 0; listeners[i]; i++) {
			if (listeners[i] === listener) {
				listeners.splice(i, 1);
				break;
			}
		}
	}
};
