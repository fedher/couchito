# Couchito.js

This is an ongoing project to make the Couchbase Lite usage easier in Phonegap apps.

I used the EventTarget class in order to add events support to custom JavaScript objects and, at
the same time, keep the example as simple as I can. You're free to change the classes and use any 
other library.

This work is based on the projects CouchChat and TodoLite.


## Preconditions

1. Create a phonegap project.
2. Copy the SyncManager.js, Couch.js and coax.js files into www directory.
3. Include those files in the index.html.


## Couch class

Couch uses internally two instances of a sync manager, one for pulling changes and another one for
pushing them to the Sync Gateway.

### Example

```
var couchito = new Couch();

couchito.init(dbname);

// Starts up the sync process.
couchito.sync(email, password, function () {
	// ...
});

couchito.addListener('pull.synched', function () {    
    console.log('pull.synched event!');
    // ...
});

// Creates a new document.
var doc = {
    title: 'foo',
    type: 'news',
    text: 'bar'
};

couchito.post(
    {
        doc: doc
    }, 
    function (err, newDoc) {
        if (err) {
            console.error('Error: ', JSON.stringify(err));
            return;
        }

        console.log('resp: ', JSON.stringify(newDoc));

        // Sets up the new id and rev_id.
        doc._id = newDoc.id;
        doc._rev = newDoc.rev;
    }
);

// Gets a doc.
couchito.get({ doc: id }, callback);

// Updates a doc.
couchito.put({ doc: doc }, callback);

```


## SyncManager class

This class is used to start the replication (pull or push, or both) process.

## Example

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

pull.addListener('synched', function () {
	console.log('Pull sync finished');
});


pull.start();

pull.waitForSync(function () { 
	console.log('Pull sync finished.');

	push.start();
});
```


## TODO

- Add a class as a wrapper to make the HTTP requests (implement strategy pattern maybe), in order
not to depend on coax library.

- Fire an event when detect new changes in the db.

