require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var core = require("./hoax-core"),
  request = require("browser-request");

request.log.debug = function() {};

module.exports = core(request);

},{"./hoax-core":2,"browser-request":3}],2:[function(require,module,exports){
/*
 * hoax
 * https://github.com/jchris/hoax
 *
 * Copyright (c) 2013 Chris Anderson
 * Licensed under the Apache license.
 */

module.exports = function(request) {
  var pax = require("pax");

  function makeHoaxCallback(cb, verb) {
    return function(err, res, body){
      // console.log("hoax cb", verb||"get", err, res.statusCode, body);
      if (err && err !== "error") {
        cb(err, res, body);
      } else {
        if (res.statusCode >= 400 || err === "error") {
          cb(body || res.statusCode, res);
        } else {
          cb(null, body);
        }
      }
    };
  }

  function processArguments(myPax, urlOrOpts, data, cb, verb) {
    var opts = {}, newPax = myPax;
    if (typeof urlOrOpts === 'function') {
      cb = urlOrOpts;
      data = null;
      urlOrOpts = null;
    } else {
      if (urlOrOpts.uri || urlOrOpts.url) {
        newPax = myPax(urlOrOpts.uri || urlOrOpts.url);
      } else {
        if (typeof data === 'function') {
          // we have only 2 args
          // the first is data if it is not an array
          // and the verb is put or post
          cb = data;
          data = null;
          if ((verb === "put" || verb === "post") &&
            (typeof urlOrOpts !== "string" &&
              Object.prototype.toString.call(urlOrOpts) !== '[object Array]')) {
              data = urlOrOpts;
          } else {
            newPax = myPax(urlOrOpts);
          }
        } else {
          newPax = myPax(urlOrOpts);
        }
      }
    }
    opts.headers = {'content-type': 'application/json'};
    opts.json = true;
    opts.uri = newPax.toString();
    if (data) {
      opts.body = JSON.stringify(data);
    }
    return [opts, cb, newPax];
  }

  function extenderizer(oldHoax) {
    return function(name, fun) {
      this.methods = this.methods || {};
      this.methods[name] = fun;
      this[name] = fun;
    };
  }

  function addExtensions(newHoax, oldHoax) {
    if (oldHoax && oldHoax.methods) {
      var k;
      for (k in oldHoax.methods) {
        newHoax[k] = oldHoax.methods[k];
      }
    }
  }

  function makeHoax(myPax, verb, oldHoax) {
    var newHoax = function(opts, data, xcb) {
      var args = processArguments(myPax, opts, data, xcb, verb),
        reqOpts = args[0], // includes uri, body
        cb = args[1],
        newPax = args[2];
      if (cb) {
        // console.log(["hoax", verb||"get", reqOpts]);
        if (verb) {
          if (verb == "del") {
            reqOpts.method = "DELETE";
          } else {
            reqOpts.method = verb.toUpperCase();
          }
          return request(reqOpts, makeHoaxCallback(cb, verb));
        } else {
          return request(reqOpts, makeHoaxCallback(cb));
        }
      } else {
        // console.log("new hoax", newPax);
        return makeHoax(newPax, verb, newHoax);
      }
    };
    if (!verb) {
      "get put post head del".split(" ").forEach(function(v){
        newHoax[v] = makeHoax(myPax, v, newHoax);
      });
    }
    addExtensions(newHoax, oldHoax);
    // should this be extenderizer(newHoax) ?
    newHoax.extend = extenderizer(oldHoax);
    newHoax.pax = myPax; // deprecated
    newHoax.url = myPax;
    return newHoax;
  }

  var Hoax = makeHoax(pax());
  Hoax.makeHoax = makeHoax;

  return Hoax;
};

},{"pax":4}],3:[function(require,module,exports){
// Browser Request
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// UMD HEADER START 
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.returnExports = factory();
  }
}(this, function () {
// UMD HEADER END

var XHR = XMLHttpRequest
if (!XHR) throw new Error('missing XMLHttpRequest')
request.log = {
  'trace': noop, 'debug': noop, 'info': noop, 'warn': noop, 'error': noop
}

var DEFAULT_TIMEOUT = 3 * 60 * 1000 // 3 minutes

//
// request
//

function request(options, callback) {
  // The entry-point to the API: prep the options object and pass the real work to run_xhr.
  if(typeof callback !== 'function')
    throw new Error('Bad callback given: ' + callback)

  if(!options)
    throw new Error('No options given')

  var options_onResponse = options.onResponse; // Save this for later.

  if(typeof options === 'string')
    options = {'uri':options};
  else
    options = JSON.parse(JSON.stringify(options)); // Use a duplicate for mutating.

  options.onResponse = options_onResponse // And put it back.

  if (options.verbose) request.log = getLogger();

  if(options.url) {
    options.uri = options.url;
    delete options.url;
  }

  if(!options.uri && options.uri !== "")
    throw new Error("options.uri is a required argument");

  if(typeof options.uri != "string")
    throw new Error("options.uri must be a string");

  var unsupported_options = ['proxy', '_redirectsFollowed', 'maxRedirects', 'followRedirect']
  for (var i = 0; i < unsupported_options.length; i++)
    if(options[ unsupported_options[i] ])
      throw new Error("options." + unsupported_options[i] + " is not supported")

  options.callback = callback
  options.method = options.method || 'GET';
  options.headers = options.headers || {};
  options.body    = options.body || null
  options.timeout = options.timeout || request.DEFAULT_TIMEOUT

  if(options.headers.host)
    throw new Error("Options.headers.host is not supported");

  if(options.json) {
    options.headers.accept = options.headers.accept || 'application/json'
    if(options.method !== 'GET')
      options.headers['content-type'] = 'application/json'

    if(typeof options.json !== 'boolean')
      options.body = JSON.stringify(options.json)
    else if(typeof options.body !== 'string')
      options.body = JSON.stringify(options.body)
  }
  
  //BEGIN QS Hack
  var serialize = function(obj) {
    var str = [];
    for(var p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    return str.join("&");
  }
  
  if(options.qs){
    var qs = (typeof options.qs == 'string')? options.qs : serialize(options.qs);
    if(options.uri.indexOf('?') !== -1){ //no get params
        options.uri = options.uri+'&'+qs;
    }else{ //existing get params
        options.uri = options.uri+'?'+qs;
    }
  }
  //END QS Hack
  
  //BEGIN FORM Hack
  var multipart = function(obj) {
    //todo: support file type (useful?)
    var result = {};
    result.boundry = '-------------------------------'+Math.floor(Math.random()*1000000000);
    var lines = [];
    for(var p in obj){
        if (obj.hasOwnProperty(p)) {
            lines.push(
                '--'+result.boundry+"\n"+
                'Content-Disposition: form-data; name="'+p+'"'+"\n"+
                "\n"+
                obj[p]+"\n"
            );
        }
    }
    lines.push( '--'+result.boundry+'--' );
    result.body = lines.join('');
    result.length = result.body.length;
    result.type = 'multipart/form-data; boundary='+result.boundry;
    return result;
  }
  
  if(options.form){
    if(typeof options.form == 'string') throw('form name unsupported');
    if(options.method === 'POST'){
        var encoding = (options.encoding || 'application/x-www-form-urlencoded').toLowerCase();
        options.headers['content-type'] = encoding;
        switch(encoding){
            case 'application/x-www-form-urlencoded':
                options.body = serialize(options.form).replace(/%20/g, "+");
                break;
            case 'multipart/form-data':
                var multi = multipart(options.form);
                //options.headers['content-length'] = multi.length;
                options.body = multi.body;
                options.headers['content-type'] = multi.type;
                break;
            default : throw new Error('unsupported encoding:'+encoding);
        }
    }
  }
  //END FORM Hack

  // If onResponse is boolean true, call back immediately when the response is known,
  // not when the full request is complete.
  options.onResponse = options.onResponse || noop
  if(options.onResponse === true) {
    options.onResponse = callback
    options.callback = noop
  }

  // XXX Browsers do not like this.
  //if(options.body)
  //  options.headers['content-length'] = options.body.length;

  // HTTP basic authentication
  if(!options.headers.authorization && options.auth)
    options.headers.authorization = 'Basic ' + b64_enc(options.auth.username + ':' + options.auth.password);

  return run_xhr(options)
}

var req_seq = 0
function run_xhr(options) {
  var xhr = new XHR
    , timed_out = false
    , is_cors = is_crossDomain(options.uri)
    , supports_cors = ('withCredentials' in xhr)

  req_seq += 1
  xhr.seq_id = req_seq
  xhr.id = req_seq + ': ' + options.method + ' ' + options.uri
  xhr._id = xhr.id // I know I will type "_id" from habit all the time.

  if(is_cors && !supports_cors) {
    var cors_err = new Error('Browser does not support cross-origin request: ' + options.uri)
    cors_err.cors = 'unsupported'
    return options.callback(cors_err, xhr)
  }

  xhr.timeoutTimer = setTimeout(too_late, options.timeout)
  function too_late() {
    timed_out = true
    var er = new Error('ETIMEDOUT')
    er.code = 'ETIMEDOUT'
    er.duration = options.timeout

    request.log.error('Timeout', { 'id':xhr._id, 'milliseconds':options.timeout })
    return options.callback(er, xhr)
  }

  // Some states can be skipped over, so remember what is still incomplete.
  var did = {'response':false, 'loading':false, 'end':false}

  xhr.onreadystatechange = on_state_change
  xhr.open(options.method, options.uri, true) // asynchronous
  if(is_cors)
    xhr.withCredentials = !! options.withCredentials
  xhr.send(options.body)
  return xhr

  function on_state_change(event) {
    if(timed_out)
      return request.log.debug('Ignoring timed out state change', {'state':xhr.readyState, 'id':xhr.id})

    request.log.debug('State change', {'state':xhr.readyState, 'id':xhr.id, 'timed_out':timed_out})

    if(xhr.readyState === XHR.OPENED) {
      request.log.debug('Request started', {'id':xhr.id})
      for (var key in options.headers)
        xhr.setRequestHeader(key, options.headers[key])
    }

    else if(xhr.readyState === XHR.HEADERS_RECEIVED)
      on_response()

    else if(xhr.readyState === XHR.LOADING) {
      on_response()
      on_loading()
    }

    else if(xhr.readyState === XHR.DONE) {
      on_response()
      on_loading()
      on_end()
    }
  }

  function on_response() {
    if(did.response)
      return

    did.response = true
    request.log.debug('Got response', {'id':xhr.id, 'status':xhr.status})
    clearTimeout(xhr.timeoutTimer)
    xhr.statusCode = xhr.status // Node request compatibility

    // Detect failed CORS requests.
    if(is_cors && xhr.statusCode == 0) {
      var cors_err = new Error('CORS request rejected: ' + options.uri)
      cors_err.cors = 'rejected'

      // Do not process this request further.
      did.loading = true
      did.end = true

      return options.callback(cors_err, xhr)
    }

    options.onResponse(null, xhr)
  }

  function on_loading() {
    if(did.loading)
      return

    did.loading = true
    request.log.debug('Response body loading', {'id':xhr.id})
    // TODO: Maybe simulate "data" events by watching xhr.responseText
  }

  function on_end() {
    if(did.end)
      return

    did.end = true
    request.log.debug('Request done', {'id':xhr.id})

    xhr.body = xhr.responseText
    if(options.json) {
      try        { xhr.body = JSON.parse(xhr.responseText) }
      catch (er) { return options.callback(er, xhr)        }
    }

    options.callback(null, xhr, xhr.body)
  }

} // request

request.withCredentials = false;
request.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;

//
// defaults
//

request.defaults = function(options, requester) {
  var def = function (method) {
    var d = function (params, callback) {
      if(typeof params === 'string')
        params = {'uri': params};
      else {
        params = JSON.parse(JSON.stringify(params));
      }
      for (var i in options) {
        if (params[i] === undefined) params[i] = options[i]
      }
      return method(params, callback)
    }
    return d
  }
  var de = def(request)
  de.get = def(request.get)
  de.post = def(request.post)
  de.put = def(request.put)
  de.head = def(request.head)
  return de
}

//
// HTTP method shortcuts
//

var shortcuts = [ 'get', 'put', 'post', 'head' ];
shortcuts.forEach(function(shortcut) {
  var method = shortcut.toUpperCase();
  var func   = shortcut.toLowerCase();

  request[func] = function(opts) {
    if(typeof opts === 'string')
      opts = {'method':method, 'uri':opts};
    else {
      opts = JSON.parse(JSON.stringify(opts));
      opts.method = method;
    }

    var args = [opts].concat(Array.prototype.slice.apply(arguments, [1]));
    return request.apply(this, args);
  }
})

//
// CouchDB shortcut
//

request.couch = function(options, callback) {
  if(typeof options === 'string')
    options = {'uri':options}

  // Just use the request API to do JSON.
  options.json = true
  if(options.body)
    options.json = options.body
  delete options.body

  callback = callback || noop

  var xhr = request(options, couch_handler)
  return xhr

  function couch_handler(er, resp, body) {
    if(er)
      return callback(er, resp, body)

    if((resp.statusCode < 200 || resp.statusCode > 299) && body.error) {
      // The body is a Couch JSON object indicating the error.
      er = new Error('CouchDB error: ' + (body.error.reason || body.error.error))
      for (var key in body)
        er[key] = body[key]
      return callback(er, resp, body);
    }

    return callback(er, resp, body);
  }
}

//
// Utility
//

function noop() {}

function getLogger() {
  var logger = {}
    , levels = ['trace', 'debug', 'info', 'warn', 'error']
    , level, i

  for(i = 0; i < levels.length; i++) {
    level = levels[i]

    logger[level] = noop
    if(typeof console !== 'undefined' && console && console[level])
      logger[level] = formatted(console, level)
  }

  return logger
}

function formatted(obj, method) {
  return formatted_logger

  function formatted_logger(str, context) {
    if(typeof context === 'object')
      str += ' ' + JSON.stringify(context)

    return obj[method].call(obj, str)
  }
}

// Return whether a URL is a cross-domain request.
function is_crossDomain(url) {
  var rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/

  // jQuery #8138, IE may throw an exception when accessing
  // a field from window.location if document.domain has been set
  var ajaxLocation
  try { ajaxLocation = location.href }
  catch (e) {
    // Use the href attribute of an A element since IE will modify it given document.location
    ajaxLocation = document.createElement( "a" );
    ajaxLocation.href = "";
    ajaxLocation = ajaxLocation.href;
  }

  var ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
    , parts = rurl.exec(url.toLowerCase() )

  var result = !!(
    parts &&
    (  parts[1] != ajaxLocParts[1]
    || parts[2] != ajaxLocParts[2]
    || (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (ajaxLocParts[3] || (ajaxLocParts[1] === "http:" ? 80 : 443))
    )
  )

  //console.debug('is_crossDomain('+url+') -> ' + result)
  return result
}

// MIT License from http://phpjs.org/functions/base64_encode:358
function b64_enc (data) {
    // Encodes string using MIME base64 algorithm
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc="", tmp_arr = [];

    if (!data) {
        return data;
    }

    // assume utf8 data
    // data = this.utf8_encode(data+'');

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1<<16 | o2<<8 | o3;

        h1 = bits>>18 & 0x3f;
        h2 = bits>>12 & 0x3f;
        h3 = bits>>6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
        break;
        case 2:
            enc = enc.slice(0, -1) + '=';
        break;
    }

    return enc;
}
    return request;
//UMD FOOTER START
}));
//UMD FOOTER END

},{}],4:[function(require,module,exports){
/*
 * pax
 * https://github.com/jchris/pax
 *
 * Copyright (c) 2013 Chris Anderson
 * Licensed under the APL license.
 */

function objToQuery(q) {
  var k, ks = Object.keys(q), v, query = [];
  for (k = 0; k < ks.length; k++) {
    v = q[ks[k]];
    query.push(encodeURIComponent(ks[k])+'='+encodeURIComponent(v.toString()));
  }
  return query.join('&');
}

// if there is an object in the new path,
// pluck it out and put it on the pax instance;

function processPath(path) {
  var query;
  if (path && path.pop && path.length) {
    if (typeof path[path.length-1] === 'object') {
      path.query = path.pop();
    }
    return path;
  } else if (typeof path === "object") { // options
    var empty = [];
    empty.query = path;
    return empty;
  } else if (path) { // string
    return [path];
  } else {
    return [];
  }
}

function merge(target, source) {
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key];
    }
  }
  return target;
}

function mergePaths(path, newPath) {
  var k, merged = path.concat(newPath);
  merged.methods = {};
  if (path.query)  {
    merged.query = merge({}, path.query);
  }
  if (newPath.query) {
    merged.query = merge(merged.query || {}, newPath.query);
  }
  if (typeof path.getQuery !== 'undefined') {
    merged.getQuery = path.getQuery;
  }
  for (k in path.methods) {
    merged.methods[k] = path.methods[k];
  }

  // if (typeof newPath.getQuery !== 'undefined') {
  //   merged.getQuery = newPath.getQuery;
  // }
  return merged;
}

function makeToString(path) {
  var first = true,
  encoded = path.map(function(p) {
    if (first) {
      first = false;
      if (/^http/.test(p)) {
        if (/\/$/.test(p)) {
          return p.substring(0,p.length-1);
        } else {
          return p;
        }
      }
    }
    return encodeURIComponent(p);
  });

  return function() {
    if (path.query) {
      var qobj;
      if (path.getQuery || this.getQuery) {
        qobj = (path.getQuery || this.getQuery)(path.query);
      } else {
        qobj = path.query;
      }
      return encoded.join('/') + '?' + objToQuery(qobj);
    } else {
      return encoded.join('/');
    }
  };
}

function extenderizer(path) {
  path.methods = path.methods || {};
  return function(name, fun) {
    path.methods[name] = fun;
    this[name] = fun;
  };
}

function addExtensions(pax, path) {
  var k;
  for (k in path.methods) {
    pax[k] = path.methods[k];
  }
}

var growPax;

function makeNextPathFun(path) {
  var nextPax = function(nextPath) {
    // console.log("nextPax",nextPax);
    if (typeof nextPax.getQuery !== 'undefined') {path.getQuery = nextPax.getQuery;}
    if (arguments.length > 1) {
      return growPax(path, [].map.call(arguments,function(arg){return arg;}));
    } else {
      return growPax(path, nextPath);
    }
  };
  addExtensions(nextPax, path);
  nextPax.extend = extenderizer(path);
  // console.log(["pax", path, path.query]);
  nextPax.toString = makeToString(path);
  // console.log(["paxs", nextPax.toString()]);
  return nextPax;
}

function growPax(path, newPath) {
  newPath = processPath(newPath);
  path = mergePaths(path, newPath);
  return makeNextPathFun(path);
}

module.exports = makeNextPathFun([]);


},{}],"coax":[function(require,module,exports){
/*
 * coax
 * https://github.com/jchris/coax
 *
 * Copyright (c) 2013 Chris Anderson
 * Licensed under the Apache license.
 */
var pax = require("pax"),
  hoax = require("hoax");

var coaxPax = pax();

coaxPax.extend("getQuery", function(params) {
  params = JSON.parse(JSON.stringify(params));
  var key, keys = ["key", "startkey", "endkey", "start_key", "end_key"];
  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    if (params[key]) {
      params[key] = JSON.stringify(params[key]);
    }
  }
  return params;
});

var Coax = module.exports = hoax.makeHoax(coaxPax());

Coax.extend("changes", function(opts, cb) {
  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }
  var self = this;
  opts = opts || {};


  if (opts.feed == "continuous") {
    var listener = self(["_changes", opts], function(err, ok) {
      if (err && err.code == "ETIMEDOUT") {
        return self.changes(opts, cb); // TODO retry limit?
      } else if (err) {
        return cb(err);
      }
    });
    listener.on("data", function(data){
      var sep = "\n";

      // re-emit chunked json data
      eom = data.toString().indexOf(sep)
      msg = data.toString().substring(0, eom)
      remaining = data.toString().substring(eom + 1, data.length)
      if (remaining.length > 0){
        // console.log(data.toString())
        listener.emit("data", remaining)
      }

      var json = JSON.parse(msg);
      cb(false, json)
    })
    return listener;
  } else {
    opts.feed = "longpoll";
    // opts.since = opts.since || 0;
    // console.log("change opts "+JSON.stringify(opts));
    return self(["_changes", opts], function(err, ok) {
      if (err && err.code == "ETIMEDOUT") {
        return self.changes(opts, cb); // TODO retry limit?
      } else if (err) {
        return cb(err);
      }
      // console.log("changes", ok)
      ok.results.forEach(function(row){
        cb(null, row);
      });
      opts.since = ok.last_seq;
      self.changes(opts, cb);
    });
  }
});

Coax.extend("forceSave", function(doc, cb) {
  var api = this(doc._id);
  // console.log("forceSave "+api.pax);
  api.get(function(err, old) {
    if (err && err.error !== "not_found") {
      return cb(err);
    }
    if (!err) {
      doc._rev = old._rev;
    }
    // console.log("forceSave put", api.pax, doc._rev)
    api.put(doc, cb);
  });
});


Coax.extend("channels", function(channels, opts) {
  var self = this;
  var opts = opts || {};

  opts.filter = "sync_gateway/bychannel";
  opts.feed = "continuous"
  opts.channels = channels.join(',')

  // console.log(self.pax.toString())
  var x = function(){};
  x.request = true;
  var changes = self(['_changes', opts], x);
  changes.on("data", function(data) {
    var json;
    try{
      var json = JSON.parse(data.toString())
    }catch(e){
      console.log("not json", data.toString())
    }
    if (json) {
      changes.emit("json", json)
    }
  })
  return changes;
});

},{"hoax":1,"pax":4}]},{},[]);
