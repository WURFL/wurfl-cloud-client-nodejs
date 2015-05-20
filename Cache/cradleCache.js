/**
 * The couchDB WURFL Cloud Client Cache Provider
 * 
 * The cradle library by cloudhead is used:
 * https://github.com/cloudhead/cradle
 *
 * An example of using couchDB for caching:
 * <code>
 * // Include these lines:
 * var cache = require("./Cache/cradleCache");
 * var config = require("./NodeWurflCloudClient/Config");
 * // Set API Key
 * var api_key = 'xxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
 * // Create Configuration object
 * var configuration = new config.WurflCloudConfig(api_key);
 * // Use couchDB (cradle) Caching
 * var cradlecache = new cache.WurflCloud_CacheNode(request, response, host, port);
 * // Create Client
 * client = new WurflCloud_Client(config, request, response, cradlecache);
 * </code>
 * 
 * 
 * If you have unusual traffic patterns, you may want to add some randomness to your
 * cache expiration, so you don't get a bunch of entries expiring at the same time:
 * <code>
 * // Add up to 10 minutes (600 seconds) to the cache expiration
 * cache.cache_expiration_rand_max = 600;
 * </code>
 * 
 */

var cradle = require('cradle');
var libraries = require("../Libraries/libs");
var crypto = require('crypto');
var events = require('events')
emitter = new events.EventEmitter()
emitter.setMaxListeners(0);

//constructor
var WurflCloud_CacheNode = function(request, response, host, port){
    this.host = host;
    this.port = port;
    this.request = request;
    this.response = response;
    this.cookie_name = 'NodeWurflCloud_Client';
    this.cache_expiration = 86400;  //in seconds
    this.cookie_sent = false;
    this.cookies = {};
    this.data = {};
    this.result = false;
    this.lastModified = null;
    this.connection_established = false;
    this.cache_expiration_rand_max = 0;
    this.c = new(cradle.Connection)(host,port);
    this.db = this.c.database('wurfl_couchdb');
    this.curDate = new Date();
    this.prefix = 'dbapi_';
    this.counters = {};
    emitter.once('myerror', function(err) {
	console.log('Error with the creation of the couchDB database. \nChech the connection, the port:%s and host:%s', that.port, that.host );
	that.result = false;
	return this.response.end("Error with the CouchDB database: " + err);
    }.bind(this));


}

WurflCloud_CacheNode.prototype = {
    MEMCACHE_COMPRESSED: 2,
    cache_expiration_rand_max: 0,
    cookie_name: 'NodeWurflCloud_Client',
    cache_expiration : 86400,  //in seconds
    cookie_sent: false,
    cookies: {},
    counters: {},
    data: {},
    result: false,
    request: null,
    response: null,
    lastModified: null,

    /**
     * This function gets the device capabilities for the given request from the cache provider.
     * If the record found in the cache is expired, it deletes the record and returns false.
     * @param request, http_request
     * @saves in result the available capabilities found in cache
     */    
    getDevice_DatabaseExists: function(http_request, callback){
	var user_agent = http_request.headers['user-agent'];
	var hash = crypto.createHash('md5');
	var temp_agent = hash.update(user_agent).digest("hex");
	this.connection_established = true;
	var device_id = that.db.get(temp_agent, function(error, result){
	    if(error){
		that.incrementFunction('miss');
		return callback(error, null);
	    }else{
		var curTime = that.curDate.getTime();
		//dealing with 'rows' conflict in WURFL Cloud Response and Cradle lib.
		var num = curTime - result.doc_creation;
		if(typeof result.temp_rows != 'undefined'){
		    var temp_rows = result.temp_rows;
		    result.rows = temp_rows;
		    result.temp_rows = 'undefined';
		}
		if ( this.cache_expiration_rand_max !== 0 ){ //add random time to the cache expiration
		    curTime = curTime - Math.floor(Math.random()*this.cache_expiration_rand_max+1);
		}
		if(curTime - result.doc_creation >= that.cache_expiration*1000){
		    //doc has expired => delete the doc
		    that.db.remove(temp_agent, result._rev, function (err, res) {
			if(!err){
			    that.incrementFunction('miss');
			    return callback(null, that.result);
			}else{
			    console.log("Doc couldn't be deleted!"+ JSON.stringify(err));
			    return callback(err, null);
			}
		    });
		}else{// success in get => increment hit
		    that.result = JSON.parse(result);
		    that.incrementFunction('hit');
		    return callback(null, that.result);		    
		}
	    }
	}.bind(that));
    },
    
    /**
     * If there is no database, it creates the database (couchDB).
     * If it cannot create the database (couchDB is not running) an error is emmited.
     * If a database exists, the getDevice_DatabaseExists is called which gets the device
     * capabilities for the given request from the cache provider.
     * @param request, http_request
     * @returns the results: the available capabilities found in cache
     */
    getDevice: function(http_request, callback){
	var user_agent = http_request.headers['user-agent'];
	var hash = crypto.createHash('md5');
	var temp_agent = hash.update(user_agent).digest("hex");
	
	that = this;
	this.db.exists(function (err, exists) {
	    if(!exists){ //new database creation
		that.db.create(function(error, result){
		    if(error){ //emit error event for it was impossible to create a database
			emitter.emit('myerror', error);
			return;
		    }else{
			that.getDevice_DatabaseExists(http_request, function(error1, result1){
			    if(error1){
				return callback(error1, null);
			    }else{
				return callback(null, result1);
			    }
			}.bind(that));
		    }
		}.bind(that));
	    }else if(exists){ //database was found
		that.getDevice_DatabaseExists(http_request, function(error1, result1){
		    if(error1){
			return callback(error1, null);
		    }else{
			return callback(null, result1);
		    }
		}.bind(that));
	    }
	});
    },

    /**
     * Gets the available capabilities for the given device_id
     * @param string, device_id
     * @returns the results: the available capabilities found in cache
     */        
    getDeviceFromId: function(device_id){
	this.db.get(device_id, function(error, result){
	    if(error){
		return callback(error, null);
	    }else{
		return callback(null, result);
	    }
	});
    },

    /**
     * Stores the given user agent with the given device capabilities in the cache provider
     * @param string user_agent, array capabilities
     * Creates and stores a new document with key the md5 of user_agent in CouchDB
     */
    setDevice: function(user_agent, capabilities){
	var temp_rows;
	var ttl = this.cache_expiration;
	if ( this.cache_expiration_rand_max !== 0 ){
	    ttl = ttl + Math.floor(Math.random()*this.cache_expiration_rand_max+1);
	}
	that = this;
	var curTime = this.curDate.getTime();
	capabilities['doc_creation'] = curTime;  //The creation time of the doc is used to know whether it has expired
	//dealing with 'rows' conflict in WURFL Cloud Response and Cradle lib.
	if (typeof capabilities['rows'] != 'undefined'){
	    capabilities['temp_rows'] = capabilities['rows'];
	    capabilities['rows'] = false;
	}
	that.db.save(crypto.createHash('md5').update(user_agent).digest("hex"), capabilities, function(err){
	    if(err){
		console.log("Error saving in cache:" + err);
	    }
	});
    },
    
    /**
     * Stores the given device_id with the given device capabilities in the cache provider
     * @param string device_id, array capabilities
     * Creates and stores a new document with key the device_id in CouchDB
     * --not used function--
     */
    setDeviceFromId: function(device_id, capabilities){
	ttl = this.cache_expiration;
	if ( this.cache_expiration_rand_max !== 0 ){
	    ttl = ttl + Math.floor(Math.random()*this.cache_expiration_rand_max+1);
	}
	var curTime = this.curDate.getTime();
	capabilities['doc_creation'] = curTime;  //The creation time of the doc is used to know whether it has expired
	this.db.save(device_id, capabilities, function(err){
	    if(err){
		console.log("Error saving in cache:" + err);
	    }
	});
    },

    /**
     * Increments by one the number of hits, miss or errors depending on the type_of_increment
     * @param string type_of_increment
     */
    incrementFunction: function(type_of_increment){
	this.db.get(this.prefix, function(error, result1){
	    if(!result1){
		console.log("First Time increment:" + JSON.stringify(error));
		var empty = {};
		empty[this.prefix + 'hit'] = 0;
		empty[this.prefix + 'miss'] = 0;
		empty[this.prefix + 'error'] = 0;
		this.db.save(this.prefix, empty, function(error2, result2){
		    if(!error2){ //first time here
			return result2;
		    }else{
			console.log("Error in increment.");
			return -1;
		    }
		}.bind(this));	
	    }else{
		result1[this.prefix + type_of_increment] = result1[this.prefix + type_of_increment] + 1;
		this.db.save(this.prefix, result1._rev, result1, function(error2, result2){
		    if(!error2){ //increment done
			return result2;
		    }else{
			console.log("Error in increment.");
			return -1;
		    }
		}.bind(this));	
	    }
	}.bind(this));
    },

    /**
     * Retrieves from the cache (CouchDB) the counters (hit, miss, errors, age)
     */
    updateCounters: function(callback) {
	that = this;
	this.db.get(that.prefix, function(error, result){
	    if(!error){
		this.counters = result; //update counters
		this.getReportAge(null, function(error, value){
		    if(!error){ //update reportAge counter
			this.counters[this.prefix + 'age'] = value;
			return callback(null, this.counters);
		    }else{
			this.counters[this.prefix + 'age'] = 0;
			return callback(error, value);
		    }
		}.bind(this));
	    }else{ //first time here
		this.counters[this.prefix + 'hit'] = 0;
		this.counters[this.prefix + 'miss'] = 0;
		this.counters[this.prefix + 'error'] = 0;
		this.counters[this.prefix + 'age'] = 0;
		return callback(error, null);
	    }
	}.bind(this));
    },

    /**
     * Reset the counters (hit, miss, errors, age) in the cache (CouchDB)
     */
    resetCounters: function(callback) {
	var tempCounters = {};
	tempCounters[this.prefix + 'hit'] = 0;
	tempCounters[this.prefix + 'miss'] = 0;
	tempCounters[this.prefix + 'error'] = 0;
	tempCounters[this.prefix + 'age'] = 0;
	this.db.save(this.prefix, tempCounters, function(error, result){
	    if(!error){
		console.log("Counters were reset!");
		return callback(null, result);
	    }else{
	
		that = this;
		this.db.get(this.prefix, function(error1, result1){
		    if(!error1){
			var last_rev = result1._rev;
			result1[this.prefix + 'hit'] = 0;
			result1[this.prefix + 'miss'] = 0;
			result1[this.prefix + 'error'] = 0;
			result1[this.prefix + 'age'] = 0;
			this.db.save(this.prefix, result1._rev, result1, function(error, result){
			    if(!error){ //counters were reset
				return callback(null, result);
			    }else{ //error reset counters, cound not save
				return callback(error, null);
			    }
			});
		    }else{ //error reset counters, could not get
			return callback(error1, null);
		    }
		}.bind(this));
	    }
	}.bind(this));

    },

    /**
     * Resets the reportTime in the cache (CouchDB)
     */
    resetReportAge: function(callback) {
	var reportTime = {};
	reportTime['value'] = this.curDate.getTime();
	this.db.save('reportTime', reportTime, function(error, result){
	    if(!error){ //report time was reset, first time
		return callback(null, result);
	    }else{ 
		this.db.get('reportTime', function(error, result1){
		    if(!error){ //get the value of reportTime
			result1.value =this.curDate.getTime();
			this.db.save('reportTime', result1._rev, result1, function(error, result){
			    if(!error){ //reset reportTime
				return callback(null, result);
			    }else{
				console.log("Error resetReportAge: " + JSON.stringify(error));
				return callback(error, null);
			    }
			});
		    }else{
			console.log("Error resetRportAge." + JSON.stringify(error));
			return callback(error, null);
		    }
		}.bind(this));	    
	    }
	});
    },

    /**
     * It gets the reportTime from cache.
     * param int value
     * It returns the value if it is the first time in getReportAge
     */
    getReportAge: function(value, callback){
	this.db.get('reportTime', function(error, result){
	    if(!error){
		var last_time = result.value;
		return callback(null, this.curDate.getTime() - last_time);
	    }else{
		//If it is the first time in getReportAge,
		//the value (this.config.report_interval) is returned.
		console.log("No res INSIDE getReportAge: ");
		return callback(null, value);
	    }
	}.bind(this));
    },

};

exports.WurflCloud_CacheNode = WurflCloud_CacheNode;