/**
 * Copyright (c) 2015 J. Federico Hernandez
 * MIT License
 */

var Couch = function (config) {
    EventTarget.call(this);

    this.dbHost = config.dbHost || 'http://lite.couchbase./';

    this.syncTarget = config.syncTarget || '';

    this.dbName = config.dbName || '';
};

Couch.prototype = new EventTarget();

Couch.prototype.init = function (dbName) {
    var me = this;
    var coax;
    var dbCfg;

    if (!window.cblite) {
        console.error('couchbase: ', 'Couchbase not installed!');
        return;
    }

    dbName = dbName || this.dbName;

    me.coax = require('coax');
    me.db = me.coax([me.dbHost, dbName]);
    me.views = {};

    cblite.getURL(function (err, url) {
        console.log('couchbase: ', 'Couchbase Lite URL ', url);

        me.db.get(function (err, res, body) {

            me.db.put(function (err, res, body) {
                if (err && err.status !== 412) {
                    console.error('couchbase: ', 'Error while updating the local db: ', JSON.stringify(err));
                    return;
                }

                me.db.get(function (err, info) {
                    if (err) {
                        console.error('couchbase: ', 'Error while getting the local db: ', JSON.stringify(err));
                        return;
                    }

                    console.log('couchbase: ', 'DB info: ', JSON.stringify(info));

                    me.dispatchEvent('init');
                });
            });
        });
    });
};

Couch.prototype.post = function (params, callback) {
    var me = this;

    if (params && params.bulkDocs) {
        return me.db.post('_bulk_docs', { docs: params.docs }, callback);
    }

    me.db.post(params.doc, callback);
};

Couch.prototype.put = function (params, callback) {
    var me = this;
    me.db.put(params.doc.id, params.doc, callback);
};

// Couch.prototype.destroy = function (params, callback) {
//     // @@ TODO !!
// };

Couch.prototype.get = function (params, callback) {
    var me = this;

    if (params && params.allDocs) {
        return me.db.get('_all_docs', callback);
        // return me.db.get('_all_docs', { skip: params.start, limit: params.limit }, callback);
    }

    // @@ TODO: should I add the views as an option to get documents?

    me.db.get(params.doc.id, callback);
};


// Couch.prototype.createUserViews = function (callback) {
//     var me = this;
//     var viewId = '_design/design_users';

//     me.createViews(viewId, {
//         'users': {
//             map: function (doc) {
//                 if (doc.type && doc.type === 'user') {
//                     emit(doc.type, doc);
//                 }
//             }.toString()
//         }
//     }, callback);
// };

    
Couch.prototype.createViews = function (id, views, callback) {
    var me = this;

    function setupView(_id, _views, callback) {
        me.db.put(_id,
            {
                views: _views
            },

            function (err) {
                if (err) {
                    return callback(err);
                }
                return callback(false, me.db([_id, "_view"]));
            }
        );
    }

    me.db.get(id, function (err, doc) {
        if (err && err.status && err.status === 404) {
            return setupView(id, views, callback);
        }

        if (err) {
            return callback(err);
        }

        return callback(false, doc);
    });
};

Couch.prototype.getDocFromView = function (id, view, key, callback) {
    var me = this;
    
    me.views[id]([view, { key: key, include_docs : true }], callback);
    // me.views([view, { key: id }], callback);
};

Couch.prototype.sync = function (user, password, callback) {
    var me = this;
    var syncTargetUrl;
    var pushSync, pullSync;

    syncTargetUrl = me.syncTarget + me.dbName;
    syncTargetUrl = syncTargetUrl.replace('{user}', encodeURIComponent(user));
    syncTargetUrl = syncTargetUrl.replace('{password}', encodeURIComponent(password));

    console.log('couchbase: ', 'sync target: ' + syncTargetUrl);

    pushSync = new SyncManager({
        source : me.dbName,
        target : {
            url: syncTargetUrl
        },
        continuous : true
    });

    pullSync = new SyncManager({
        target : me.dbName,
        source : {
            url: syncTargetUrl
        },
        continuous : true
    });

    pullSync.start();

    pullSync.waitForSync(function () {
        me.dispatchEvent('pull.synched');
        
        pushSync.start();
    });

    // pullSync.start();

    // @@ README: Enable this to execute code from pull or push managers from the browser's console.
    // me.pull = pullSync;
    // me.push = pushSync;

    return callback();
};


Couch.prototype.getChanges = function (opts, callback) {
    var me = this;

    opts = opts || {
        feed: 'longpoll',
        include_docs: true,
        conflicts: true,
        style: 'all_docs',
        since: 0, // Replace this value by the info.update_seq returned when the db is set up.
        limit: 100
    };

    me.coax([me.getSyncTarget(), '_changes', opts], function (err, ok) {
        if (err) {
            return callback(err);
        }

        callback(false, ok);
    });
};
