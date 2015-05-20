/**
 * This software is the Copyright of ScientiaMobile, Inc.
 * 
 * Please refer to the LICENSE.txt file distributed with the software for licensing information.
 * 
 * @module NodeWurflCloudClient
 */
var httpClient = require("./httpClient");
var cache = require("../Cache/Cache");
var libraries = require("../Libraries/libs");

//constructor
var WurflCloudClient = function(config, user_request, user_response, type_of_cache){
    this.config = config;
    this.cache = type_of_cache;
    if(!type_of_cache){  //cookies cache
	this.cache = new cache.WurflCloud_CacheNode(user_request, user_response);
    }
    this.wcloud_host = this.config.getCloudHost();
    this.http_client = new httpClient.callWurflServer(); 
    this.http_request = user_request;
    this.http_response = user_response;
    this.capabilities= [];
    this.errors = [];
    this.search_capabilities = [];
    this.user_agent = null;
    this.request_path = null;
    this.json = null;
    this.report_data = [];
    this.client_version = "1.0.2";
    this.api_version = null;
    this.api_username = null;
    this.api_password = null;
    this.loaded_date= null;
    this.user_response = null;
    this.http_request_options = {};
    this.source = null;
}

WurflCloudClient.prototype = {
    ERROR_CONFIG: 1,
    ERROR_NO_SERVER: 2,
    ERROR_TIMEOUT: 4,
    ERROR_BAD_RESPONSE: 8,
    ERROR_AUTH: 16,
    ERROR_KEY_DISABLED: 32,
    SOURCE_NONE: "none",
    SOURCE_CLOUD: "cloud",
    SOURCE_CACHE: "cache",
    capabilities: [],
    errors: [],
    search_capabilities: [],
    include_headers: [
	"X-Device-User-Agent",
	"X-Original-User-Agent",
	"X-Operamini-Phone-UA",
	"X-Skyfire-Phone",
	"X-Bolt-Phone-UA",
	"X-Wap-Profile",
	"Profile",
	"User-Agent"
    ],
    user_agent: null,
    http_request: null,
    wcloud_host:null,
    request_path: null,
    json: null,
    report_data: [],
    client_version: "1.0.2",
    api_version: null,
    api_username: null,
    api_password: null,
    loaded_date: null,
    config: null, //client configuration object
    cache: null, //client cache object
    source: null, //source of the last detection
    http_request_options: {},
    /**
     * Get the requested capabilities from the WURFL Cloud for the given HTTP Request
     * @param array http_request HTTP Request of the device being detected
     * @param object literal search_capabilities containing the capabilities that you would like to retrieve
     */
    detectDevice: function(http_request, search_capabilities, callback){
	this.source = this.SOURCE_NONE;
	this.http_request = http_request; 
	this.search_capabilities = (search_capabilities === null)? []: search_capabilities;
	this.user_agent = this._getUserAgent(http_request);
	var result = null;
	var thiss = this;

	this.cache.getDevice(http_request, function(){
	    result = thiss.cache.result;
	    if (!result) { //no cache found
		thiss.source = thiss.SOURCE_CLOUD;
		var that = thiss;
		thiss._callWurflCloud(function(err){
		    if(err){
			return callback(err, null);
		    }else{
			    if (!thiss._allCapabilitiesPresent()){ //despite the new connection to the WURFL CLoud there are still some capabilities that are missing
				return callback('Some of the requested capabilities are invalid or you are not subscribed to all of them.', null);
			    }else{
				return callback(null, thiss.capabilities);
			    }
		    }
		});
	    }else{ //found in cache
		thiss.source = thiss.SOURCE_CACHE;
		thiss.capabilities = result;
		if (!thiss._allCapabilitiesPresent()){ //all search_capabilities were not found in cache
		    thiss.source = thiss.SOURCE_CLOUD;
		    var initial_capabilities = thiss.capabilities;
		    var that = thiss;
		    thiss._callWurflCloud(function(err){
			if(err){
			    return callback(err, null);
			}else{
			    that.capabilities = libraries.array_merge(that.capabilities, that.initial_capabilities);
			    if (!thiss._allCapabilitiesPresent()){
				return callback('Some of the requested capabilities are invalid or you are not subscribed to all of them.', null);
			    }else{
				return callback(null, thiss.capabilities);
			    }
			}
		    });
		}else{  //all search_capabilities found in cache
		    return callback(null, thiss.capabilities);
		}
	    }
	});
    },

    /**
     * Gets the source of the result.  Possible values:
     *  - cache:  from local cache
     *  - cloud:  from WURFL Cloud Service
     *  - none:   no detection was performed
     *  @return string 'cache', 'cloud' or 'none'
     */
    getSource: function() {
	return this.source;
    },

    /**
     * Initializes the WURFL Cloud request
     */
    _initializeRequest: function(callback){
	this._splitApiKey();
	var report_age;
	this.cache.getReportAge(this.config.report_interval, function(error, result){
	    report_age = result;

	//adding the appropriate HTTP Headers to the request
	    this.http_request_options['X-Cloud-Client'] = 'WurflCloudClient/NodeJS_'+this.client_version;
	    var ip = this.http_request.connection.remoteAddress;
	    var fwd = null;
	    if (typeof this.http_request.headers['x-forwarded-for'] != 'undefined') {
		fwd = this.http_request.headers['x-forwarded-for'];
	    }

	    if (fwd != null){
		this.http_request_options['X-Forwarded-For'] = ip.toString() +',' +fwd.toString();
	    }else{
		this.http_request_options['X-Forwarded-For'] = ip;
	    }
	    
	    if (typeof this.http_request.headers['accept'] != 'undefined'){
		this.http_request_options['X-Accept'] = this.http_request.headers['accept'];
	    }
	    
	    //Add the original request headers to this request
	    for (var i in this.include_headers) {
		var header_name = this.include_headers[i];
		if (typeof this.http_request.headers[header_name.toLowerCase()] != 'undefined') {
		    this.http_request_options[header_name] = this.http_request.headers[header_name.toLowerCase()];
		}
	    }

	    if (this.search_capabilities.length === 0){
		this.request_path = '/v1/json/';
	    }else{
		var temp ='';
		for(var i=0; i<this.search_capabilities.length-1;i++){
		    temp = temp + this.search_capabilities[i] + ',';
		}
		temp = temp + this.search_capabilities[i++];
		this.request_path = '/v1/json/search:(' + temp + ')';
	    }

	    if(this.config.report_interval > 0 && report_age >= this.config.report_interval){
		this._addReportDataToRequest(function(err, res){
		    if(err){
			console.log("error addReportDataToRequest:" + err);
		    }
		    this.cache.resetReportAge(function(err2, res2){
			if(err){
			    console.log("error resetReportAge:" + err);
			}
			else{
			    return callback();
			}
		    }.bind(this));
		}.bind(this));
	    }else{
		return callback();
	    }
	}.bind(this));
    },				

    /**
     * Get the date that the WURFL Cloud Server was last updated.  This will be null if there
     * has not been a recent query to the server, or if the cached value was pushed out of memory  
     * @return int UNIX timestamp (seconds since Epoch)
     */
    getLoadedDate: function() {
	if (this.loaded_date === null){
	    //last modificatin of cache
	    this.loaded_date = this.cache.getMtime();
	}
	return this.loaded_date;
    },

	/**
	 * Checks if local cache is still valid based on the date that the WURFL Cloud Server
	 * was last updated.
	 * --not used function-- (purge function is not supported by Node-MemCache)
	 */
    validateCache: function(callback){
	var cache_mtime;
	thot = this;
	this.cache.getMtime(function(err, res){
	    if(!res || res!= that.loaded_date){
		thos = thot;

	    }
	});
    },

    /**
     * Returns true if all of the search_capabilities are present in the capabilities
     * array that was returned from the WURFL Cloud Server
     * @return boolean
     * @see WurflCloud_Client::capabilities
     */
    _allCapabilitiesPresent: function(){
	for(var i=0;i<this.search_capabilities.length;i++){
	    if(typeof this.capabilities[(this.search_capabilities[i])] == 'undefined'){
		return false;
	    }
	}
	return true;
    },

    /**
     * Retrieves the report data from the cache provider and adds it to the request
     * parameters to be included with the next request.
     */
    _addReportDataToRequest: function(callback) {
	this.cache.updateCounters(function(){
	    this.report_data = this.cache.counters;
	    this.http_client.add_header('X-Cloud-Counters', this.report_data);
	    this.cache.resetCounters(function(err, res){
		if(err){
		    return callback(err, null);
		}
		else{
		    return callback(null, res);
		}
	    });
	}.bind(this));
				    
    },
	

    /**
     * Returns in the callback function the value of the requested capability.  If the capability does not exist, returns null and the appropriate error in the callback function.
     * @param string capability The WURFL capability (e.g. "is_wireless_device")
     * @throws 'The requested capability is invalid or you are not subscribed to it
     */
    getDeviceCapability: function(capability, callback){
	capability = capability.toLowerCase();
	if(libraries.array_key_exists(capability, this.capabilities)){
	    return callback(null, this.capabilities[capability]);
	}else{
	    if(!this.http_client.wasCalled()){
		this.source = 'cloud';
		that = this;
		this._callWurflCloud(function(err){
		    if(err){
			return callback(err, null);
		    }else{
			if (libraries.array_key_exists(capability, that.capabilities)){
			    return callback(null, that.capabilities[capability]);
			}else{
			    return callback('The requested capability (' + capability + ') is invalid or you are not subscribed to it.', null);
			}
		    }
		});
	    }
	}
    },

    /**
     * Get the version of the WURFL Cloud Client (this file)
     * @return string
     */
    getClientVersion: function(){
	return this.client_version;
    },

    /**
     * Get the version of the WURFL Cloud Server.  This is only available
     * after a query has been made since it is returned in the response.
     * @return string
     */
    getAPIVersion: function(){
	return this.api_version;
    },

    /**
     * Returns the Cloud server that was used
     * @return string
     */
    getCloudServer: function(){
	return this.wcloud_host;
    },

    /**
     * Make the webservice call to the server using the GET method and load the response.
     * If there is an error, it is thrown in callback function.
     */
    _callWurflCloud: function(callback){
	this._initializeRequest(function(err){
	    this.http_client.update_headers(this.http_request_options);
	    this.http_client.update_call(this.wcloud_host, this.request_path, this.api_username, this.api_password);
	    var thos = this;
	    this.http_client.callServer(function(error){
		if(error){
		    return callback(error);
		}else{
		    
		/**
		 * When there is response from the Cloud, responseCatch event is emitted.
		 * This function handles the event. The callback function includes the response body
		 * if there is a valid response. If not, the appropriate error is thrown in callback function
		 */
		    httpClient.eventEmitter.once('responseCatch', function(response_body){
			thos.json = response_body;
			if (thos.json === null){
			    console.log('Unable to process server response!');
			    return callback('Unable to process server response!');
			}
			thos._processResponse();
			return callback();
		    }.bind(this));
		}
	    });
	}.bind(this));
    },

    /**
     * Parses the response into the capabilities array
     * If the response came from the Cloud, the cache is updated
     * (and the appropriate cookie is created inside setDevice function)
     */
    _processResponse: function(){
	this.errors = this.json.errors;
	if (typeof this.json.apiVersion != 'undefined') {
	    this.api_version = this.json.apiVersion;
	}else{
	    this.api_verion = '';
	}
	if (typeof this.json.mtime != 'undefined') {
	    this.loaded_date = this.json.mtime;
	}else{
	    this.loaded_date = '';
	}
	if (typeof this.json.id != 'undefined') {
	    this.capabilities.id = this.json['id'];
	}else{
	    this.json.id = '';
	}
	this.capabilities = libraries.array_merge(this.capabilities, {id:this.capabilities.id});
	this.capabilities = libraries.array_merge(this.capabilities, this.json.capabilities);
	if (this.source === this.SOURCE_CLOUD){
	    this.cache.setDevice(this._getUserAgent(),this.capabilities);
	}
    },

    /**
     * Return the requesting client's User Agent
     * @param source
     * @return string
     */
    _getUserAgent: function(source){
	if (source === null){
	    source = this.http_request;
	}
	var user_agent = '';
	if (typeof this.http_request.headers['x-operamini-phone-ua'] != 'undefined'){
	    user_agent = this.http_request.headers['x-operamini-phone-ua'];
	} else if (typeof this.http_request.headers['user-agent'] != 'undefined'){
	    user_agent = this.http_request.headers['user-agent'];
	}
	if (user_agent.length > 255) {
	    return user_agent.substr(0,255);
	}
	return user_agent;
    },

    /**
     * Casts strings into PHP native variable types, i.e. 'true' into true
     * @param string value
     * @return string|int|boolean|float
     */	 
    _niceCast: function(valuel){
	if(value === 'true'){
	    value = true;
	}else if (value === 'false'){
	    value = false;
	}else{
	    numval = parseFloat(value);
	    if(value === numval)
		value = numval;
	}
	return value;
    },

    /**
     * Splits the API Key into a username and password
     * @return boolean success
     */
    _splitApiKey: function(){
	if( this.config.api_key.length !== 39 || this.config.api_key.indexOf(":")!== 6){
	    console.log("Error with the key!");
	}else{
	    s_user = this.config.api_key.slice(0,6);
	    this.api_username = parseInt(s_user);
	    //cast back to string to see if the number is the same
	    if(this.api_username.toString() !== s_user){
		console.log("Error with the key!");
	    }
	    this.api_password = this.config.api_key.slice(7, 39);
	}
    }
};

exports.WurflCloudClient = WurflCloudClient;