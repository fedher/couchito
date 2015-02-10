/**
 * Copyright (c) 2015 J. Federico Hernandez
 * MIT License
 */

var SyncManager = function (settings) {
    EventTarget.call(this);

    this.config = settings || {};

    this.coax = require('coax');
    this.dbHost = settings.dbHost || 'http://lite.couchbase./';
};

SyncManager.prototype = new EventTarget();

SyncManager.prototype.start = function (settings) {
    var me = this;
    var syncSettings = settings || this.config;

    console.log('syncmanager:', 'SyncSettings: ', JSON.stringify(syncSettings));

    // Starts up the db replication process.
    me.coax.post([me.dbHost, '_replicate'], syncSettings, function (err, info) {
        if (err) {
            console.error('syncmanager:', 'Error while setting the sync object.', JSON.stringify(err));
            return;
        }

        console.log('syncmanager: ', 'Sync: ', JSON.stringify(info));
        console.log('syncmanager: ', 'Ready to process tasks.');

        me.sessionId = info.session_id;
        me.dispatchEvent('started');
    });
};

SyncManager.prototype.getTasks = function (sessionId, callback) {
    var me = this;

    me.coax.get([me.dbHost, '_active_tasks'], function (err, tasks) {
        var i, len;

        if (err) {
            return callback(err);
        }

        if (!tasks || (tasks instanceof Array && tasks.length === 0)) {
            return callback('No task to process.');
        }

        console.log('tasks.len: ', tasks.length);

        for (i = 0, len = tasks.length; i < len; i++) {
            // tasks[i].task is the session identifier, I know this is a horrible name, but this is
            // how it's returned back from couchbase.
            if (tasks[i].task === sessionId) {
                console.log(JSON.stringify(tasks[i]));
                return callback(tasks[i]);
            }
        }

        return callback('No task to process.');
    });
};

SyncManager.prototype.processTasks = function (sessionId, callback) {
    var me = this;

    sessionId = sessionId || me.sessionId;

    me.getTasks(sessionId, function(task) {
        var status;

        console.log('couchbase', 'TASK: ', JSON.stringify(task));

        if (task.error) {
            if (task.error[0] === 401) {
                me.dispatchEvent('authrequired', task);
            } else {
                me.dispatchEvent('error', task);
            }

            return callback(task.error);
        }

        //
        // Status
        //
        // - Idle: Indicates that the replication has transfered all the docs and it's monitoring for future changes.
        // - Stopped: This event is only for one-shot replication, a continuous replication never stops.
        // - Active: This status indicates that the replication is actively working.
        // - Offline: This event is fired when the remote server is not reachable.
        // 
        status = ['Idle', 'Stopped', 'Active', 'Offline'];

        // console.log('couchbase', 'Task status: ' + task.status);

        if (/Processed/.test(task.status)) {
            me.dispatchEvent('processing', task);
            console.log('syncmanager: ', 'Fired: processing');
            return callback();
        }
        else if (status.indexOf(task.status) > -1) {
            // Fires idle, stopped, active or offline events.
            me.dispatchEvent(task.status.toLowerCase(), task);
            console.log('syncmanager: ', 'Fired: ', task.status.toLowerCase());
            return callback();
        }
        else {
            console.warn('syncmanager: ', 'There is not handler for this task: ', task);
        }

        // There're no tasks to process or it couldn't get the current task, so 'none' event if fired.
        me.dispatchEvent('none');
        console.log('syncmanager: ', 'Fired: none');
        return callback();
    });
};

SyncManager.prototype.waitForSync = function (callback) {
    var me = this;

    function processTask() {
        setTimeout(function () {
            var mgr = me;

            console.log('syncmanager: ', 'waitForSync: processTasks executed!!');

            mgr.processTasks(null, function (err) {
                if (err) {
                    mgr.dispatchEvent('error', err);
                }
            });
        }, 2500);
    }

    me.addListener('none', processTask);
    me.addListener('processing', function (task) {
        console.log('-- PROCESSING event');
        processTask();
    });
    me.addListener('idle', function (task) {
        console.log('-- IDLE event');
        me.dispatchEvent('synched');
        callback(task);
    });
    me.addListener('active', function (task) {
        console.log('-- ACTIVE event');
        // @@ README: Should I call processTask() from here?
        processTask();
    });
    me.addListener('offline', function (task) {
        console.log('-- OFFLINE event');
        processTask();
    });
    me.addListener('stopped', function (task) {
        console.log('-- STOPPED event');
        me.dispatchEvent('synched');
        callback(task);
    });

    // Starts up the loop.
    processTask();
};
