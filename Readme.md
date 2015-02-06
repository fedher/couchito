CouchLite.js

This is an ongoing project to make the couchbase lite usage easier in phonegap apps.

I used the EventTarget class in order to add events support to custom JavaScript objects and, at
the same time, keep the example as simple as I can. You're free to change it and use any library.

This work is based on the projects CouchChat and TodoLite.


Preconditions

1. Create a phonegap project.
2. Copy the SyncManager.js and coax.js files into www directory.
3. Include those files in the index.html.


Example:

```
var pull = new SyncManager({ 
	target: 'dbname', 
	source: { 
		url: 'http://user:password@192.168.1.10:4984/dbname'
	}, 
	continuous: true 
});

var push = new SyncManager({ 
	source: 'dbname', 
	target: { 
		url: 'http://user:password@192.168.1.10:4984/dbname'
	}, 
	continuous: true 
});

pull.addListener('started', function () {
	console.log('Pull sync has started.');
});

pull.addListener('error', function (err) {
	console.error('Replication error: ', JSON.stringify(err));
});

pull.start();

pull.waitForSync(function () { 
	console.log('Pull sync finished.');

	push.start();
});
```
