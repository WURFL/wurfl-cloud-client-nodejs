/**
 * The MemCache WURFL Cloud Client Cache Provider
 * 
 * The node-memcache library by elbart is used:
 * https://github.com/elbart/node-memcache
 *
 * An example of using Memcache for caching:
 * <code>
 * // Include these lines:
 * var cache = require("./Cache/MemCache");
 * var config = require("./NodeWurflCloudClient/Config");
 * // Set API Key
 * var api_key = 'xxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
 * // Create Configuration object
 * var configuration = new config.WurflCloudConfig(api_key);
 * // Use Memcache Caching
 * var memcache = new cache.WurflCloud_CacheNode(request, response, host, port);
 * // Create Client
 * client = new WurflCloud_Client(configuration, request, response, memcache);
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

var memcache = require("../Libraries/memcache");
var libraries = require("../Libraries/libs");
var crypto = require('crypto');

//constructor
var WurflCloud_CacheNode = function(request, response, host, port){
    this.request = request;
    this.response = response;
    this.cache_expiration = 86400;
    this.data = {};
    this.counters = {};
    this.result = false;
    this.port = port;
    this.host = host;
    this.connection_established = false;
    this.memcacheClient = new memcache.Client();//11211, 'localhost');		
    this.cache_expiration_rand_max = 0;
    this.prefix = 'dbapi_';
    this.currentTime = new Date();
    this.connect_to_memcache(host, port);
    this.compression = true;
    this.memcacheClient.on('error', function(err){
	console.log(err + "\nThere was an error with the MemCache connection! \nCheck the connection, the host:%s and the port:%s.", host, port);
	return response.end("There was an error with the MemCache connection: " +e);
    });
}

WurflCloud_CacheNode.prototype = {
    MEMCACHE_COMPRESSED: 2,
    compression: true,
    cache_expiration_rand_max: 0,
    cache_expiration : 86400,
    data: {},
    counters: {},
    result: false,
    request: null,
    response: null,
    prefix: 'dbapi_',

    connect_to_memcache: function(host, port){
	this.memcacheClient.host = host;
	this.memcacheClient.port = port;
	this.memcacheClient.connect(function(error, result){
	    if(error){
		console.log(error);
	    }else{
		console.log(result);
	    }
	});
    },

    /**
     * Get the device capabilities for the given request from the cache provider
     * @param request, http_request
     * @saves in result the available capabilities found in cache
     */
    getDevice: function(http_request, callback){
	var user_agent = http_request.headers['user-agent'];
	var hash = crypto.createHash('md5');
	var temp_agent = hash.update(user_agent).digest("hex");
	
	that = this;
	that.memcacheClient.get(temp_agent, function(error, result){
	    var device_id = result;
	    if(error){
		that.incrementFunction('error');
		return callback(error, null);
	    }else{
		if(device_id){ //if the user_agent with the device_id was found
		    that.memcacheClient.get(device_id, function(err, res){
			if(err){
			    that.incrementFunction('error');
			    return(err, null);
			}else{  
			    if(res){ //if the device_id was found
				that.incrementFunction('hit');
				that.result = JSON.parse(res);
				return callback(null, JSON.parse(res));
			    }else{  //if the device_id was not found
				that.incrementFunction('miss');
				that.result = false;
				return callback(null, null);
			    }
			}
		    });
		}else{ //if the user agent was not found
		    that.incrementFunction('miss');
		    that.result = false;
		    return callback(null, null);
		}
	    }
	});	
    },
    
    /**
     * Get the device capabilities for the given device_id from the cache provider
     * @param string device_id
     * @saves in result the available capabilities found in cache
     * --not used function--
     */
    getDeviceFromId: function(device_id){
	this.memcacheClient.connect( function(error, result){
	    if(error){
		console.log(error);
	    }else{
		console.log(result);
		that = this;
		this.memcacheClient.get(device_id, function(error, result){
		    if(result){ //if the device_id was found
			that.incrementFunction('hit');
			that.result = JSON.parse(result);
			return callback(null, JSON.parse(result));
		    }else{  //if the device_id was not found
			that.incrementFunction('miss');
			that.result = false;
			return callback(null, null);
		    }
		});
	    }
	});
    },

    /**
     * Stores the given user agent(md5) with the given device capabilities in the cache provider for the given time period
     * @param array capabilities
     */
    setDevice: function(user_agent, capabilities){
	var compress;
	var ttl = this.cache_expiration;
	if ( this.cache_expiration_rand_max !== 0 ){
	    ttl = ttl + Math.floor(Math.random()*this.cache_expiration_rand_max+1);
	}
	if (this.compression){
	    compress = this.MEMCACHE_COMPRESSED;
	}else{
	    compress = null;
	}
	thos = this;
	that = thos;
	thos.memcacheClient.set(crypto.createHash('md5').update(user_agent).digest("hex"), capabilities.id, function(error, result){
		if(error){
		    console.log("error_save: " + JSON.stringify(error));
		}else{
		    that.memcacheClient.set(capabilities.id, JSON.stringify(capabilities), function(err, res){
			if(err){
			    console.log("error_save :" + JSON.stringify(err));
			}
		    }, ttl, compress);
		}
	}, ttl);
    },
    
    /**
     * Stores the given device_id with the given device capabilities in the cache provider
     * @param string device_id, array capabilities
     * Creates and stores the device_id with its capabilities in MemCache
     * --not used function--
     */    
    setDeviceFromId: function(device_id, capabilities){
	ttl = this.cache_expiration;
	if (this.cache_expiration_rand_max!== 0){
	    ttl = ttl + Math.floor(Math.random()*this.cache_expiration_rand_max+1);
	}
	if (this.compression){
	    compress = this.MEMCACHE_COMPRESSED;
	}else{
	    compress = null;
	}
	this.memcacheClient.add(device_id, capabilities, function(err, res){
	    if(err){
		console.log("err_save :" + err);
	    }
	}, ttl, compress);	
    },

    /**
     * Increments by one the number of hits, miss or errors depending on the type_of_increment
     * @param string type_of_increment
     * returns the key that was incremented
     */
    incrementFunction: function(type_of_increment){
	var key = this.prefix + type_of_increment;

	that = this;
	this.memcacheClient.increment(key, function(err, res){
	    if(res === null){
		thos = that;
		that.memcacheClient.add(key, 1, function(err2, res2){
		    if(res2 === null){
			thiss = thos;
			thos.memcacheClient.increment(key, function(err3, res3){
			    if(res3 === null){
				console.log("Unable to increment key: "+ key);
				return false;
			    }else{
				return res3; //incremented key
			    }
			});
		    }else{
			return res2;  //initialized key
		    }
		});
	    }else{
		return res;  //incremented key
	    }
	});
    },

    /**
     * Reset the counters (hit, miss, errors, age) in the cache (MemCache)
     */
    resetCounters: function(callback) {
	that = this;
	this.memcacheClient.set(this.prefix + 'hit', 0, function(err, res){
	    if(!err){
		thos = that;
		that.memcacheClient.set(this.prefix + 'miss', 0, function(err2, res2){
		    if(!err2){
			thit = thos;
			thos.memcacheClient.set(this.prefix + 'error', 0, function(err3, res3){
			    if(!err3){
				return callback(null, true);
			    }else{
				return callback(err3, null);
			    }
			}.bind(this));
		    }else{
			return callback(err2, null);
		    }
		}.bind(this));
	    }else{
		return callback(err, null);
	    }
	}.bind(this));
  },

    /**
     * Retrieves from the cache (MemCache) the counters (hit, miss, errors, age)
     */
    updateCounters: function(callback) {
	that = this;
	this.memcacheClient.get(this.prefix + 'hit', function(err, res){
	    that.counters[that.prefix + 'hit'] = res;
	    if (res == null){
		that.counters[that.prefix + 'hit'] = 0;
	    }			    
	    thos = that;
	    that.memcacheClient.get(that.prefix + 'miss', function(err2, res2){
		thos.counters[thos.prefix + 'miss'] = res2;
		if (res2 == null){
		    thos.counters[that.prefix + 'miss'] = 0;
		}
		thit = thos;
		thos.memcacheClient.get(thos.prefix + 'error', function(err3, res3){
		    thit.counters[thit.prefix + 'error'] = res3;
		    if (res3 == null){
			thit.counters[that.prefix + 'error'] = 0;
		    }
		    then = thit;
		    thit.getReportAge(null, function(err4, res4){
			then.counters[then.prefix + 'age'] = res4;
			if (res4 == null){
			    then.counters[then.prefix + 'age'] = 0;
			}
			return callback(null,true);
		    });
		});
	    });
	});
  },

    /**
     * Resets the reportTime in the cache (MemCache)
     */
    resetReportAge: function(callback) {
	that = this;
	this.memcacheClient.set(this.prefix + 'reportTime', this.currentTime.getTime(), function(err, res){
	    if(!err){
		return callback(null, true);
	    }else{
		return callback(err, null);
	    }
	});
    },

    /**
     * It gets the reportTime from cache.
     * param int value
     * It returns the value if it is the first time in getReportAge
     */
    getReportAge: function(value, callback){
	that = this;
	this.memcacheClient.get(this.prefix + 'reportTime', function(err, res){
	    if(res){
		var last_time = res;
		return callback(null, this.currentTime.getTime() - last_time);
	    }else{
		//If it is the first time in getReportAge,
		//the value (this.config.report_interval) is returned.
		return callback(null, value);
	    }
	}.bind(this));
    },

    /**
     * Gets statistics from the cache provider like memory usage and number of cached devices
     * @return array Cache statistics
     */
    stats: function(callback){
	this.memcacheClient.stats(function(err, res){
	    if(!err){
		return callback(null, res);
	    }else{
		return callback(err, null);
	    }
	});
    },

    /**
     * Sets the last loaded WURFL timestamp in the cache provider
     * @param int $server_mtime Loaded WURFL unix timestamp
     * --not used function--
     */
    setMtime: function(server_mtime, callback){
	that = this;
	this.memcacheClient.set(this.prefix + 'mtime', server_mtime, function(err, res){
	    return callback(err, res);
	});
    },

    /**
     * Gets the last loaded WURFL timestamp from the cache provider.
     * This is used to detect when a new WURFL has been loaded on the server 
     * @return int Loaded WURFL unix timestamp
     * --not used function--
     */
    getMtime: function(callback){
	that = this;
	this.memcacheClient.get(this.prefix + 'mtime', function(err, res){
	    return callback(err, res);
	});
    }

};

exports.WurflCloud_CacheNode = WurflCloud_CacheNode;