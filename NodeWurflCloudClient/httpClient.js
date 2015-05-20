/**
 * This software is the Copyright of ScientiaMobile, Inc.
 * 
 * Please refer to the LICENSE.txt file distributed with the software for licensing information.
 * 
 * @package NodeWurflCloudClient
 */
/**
 * This is the class for HTTP Communications
 */
var base64 = require("../Libraries/encode_base64");
var http = require('http');
var events = require('events');

var zlib = require('zlib');

//event emitted when there is a response from WURFL Cloud
var eventEmitter = new events.EventEmitter();

var callWurflServer = function(){
    this.res= '';
    this.req= '';
    this.success = false;
    this.response_body= null;
    this.use_compression = true;
    this.options= {
	port: 80,
	method: 'GET',
	headers: {
	    'Accept': '*/*',
	    'Connection': 'Close'
	}
    }
}

callWurflServer.prototype = {
    res: '',
    req: '',
    use_compression: true,
    response_body: null,
    success: false,
    options: {
	port: 80,
	method: 'GET',
	headers: {
	    'Accept': '*/*',
	    'Connection': 'Close'
	}
    },

    /**
     * If use_compression is true, we recieve Compressed responses from WURFL cloud
     */
    setUseCompression: function(use_compression){
	if(typeof use_compression == 'undefined'){
	    this.use_compression = true;
	}else{
	    this.use_compression = use_compression;
	}
    },

    /**
     * Returns true if there was a successful connection to the WURFL Cloud
     * or false when there was not.
     */
    wasCalled: function(){
	return (this.success === true);
    },

    /**
     * Updates the options of the http request to the WURFL Cloud
     * @param string wcloud_host Hostname of the remote server
     * @param string request_path Request Path/URI
     * @param string api_username Basic Auth Username
     * @param string api_password Basic Auth Password
     */
    update_call: function(wcloud_host, request_path, api_username, api_password){
	this.options.host = wcloud_host;
	this.options.path = request_path;
	encoded_key = base64.Base64.encode(api_username + ':' + api_password);
	this.options.headers.Authorization = 'Basic ' +encoded_key;
    },

    /**
     * Updates some headers of the http request to the WURFL Cloud
     * @param http_request http_client_request The http request that wants response from the WURFL Cloud
     * updates User agent and X cloud client headers.
     */
    update_headers: function(http_client_request){
	this.options.headers['User-Agent'] = http_client_request['User-Agent'];
	this.options.headers['X-Cloud-Client'] = http_client_request['X-Cloud-Client'];
	if(this.use_compression === true){
	    this.options.headers['Accept-Encoding'] = 'gzip';
	}
    },

    /**
     * Adds a header to the upcoming request to the WURFL Cloud
     * @param string type The header name
     * @param string value The value of the header to be added.
     */    
    add_header: function(type, value){
	this.options.headers[type] = value;
    },

    /**
     * Call the WURFL Cloud with the headers stored in this.options
     * The callback is used for the appropriate error catch
     * if there is no connection to the WURFL Cloud. 
     */
    callServer: function(callback){
	this.req = http.request(this.options, function(res) {
	    this.res = res;
	    var response = "";
	    var sizeOfBuffer = parseInt(res.headers['content-length']);
	    var buf = new Buffer(sizeOfBuffer);
	    var counterBuf = 0;

	    /**
	     * When there is a chunked reply from the WURFL Cloud Server
	     * append each chunk to a buffer
	     */
	    res.on('data', function (chunk) {
		if(res.statusCode >400){
		    this.success = false;
		    callback('Unable to connect to cloud, Error Code: '+res.statusCode.toString());
		}else{
		    if(res.headers['content-encoding'] == 'gzip'){   //gzip response
			if (counterBuf == 0){
			    chunk.copy(buf)
			}else{
			    chunk.copy(buf, counterBuf);
			}
			counterBuf = counterBuf + chunk.length;
		    }else{   //normal response
			response += chunk.toString();
		    }
		}
	    });

	    /**
	     * When all the chunked pieces have arrived,
	     * gunzip the total response (if neccessary) and then
	     * emit the response_body
	     */
	    res.on('end', function(){
		if(res.headers['content-encoding'] == 'gzip'){   //gzip response
		    zlib.unzip(buf, function(err, result){
			if(err){
			    callback("Unable to gunzip the response from server:"+err, null);
			}else{
			    try{
				this.response_body = JSON.parse(result.toString());
			    }catch(err){
				console.log("Error in Parsing JSON repsonse from server: " + err);
				this.response_body = null;
			    }finally{
				this.success = true;
				eventEmitter.emit('responseCatch', this.response_body);
			    }
			}
		    });
		}else{   //normal response
		    try{
			this.response_body = JSON.parse(response);
		    }catch(err){
			this.response_body = null;
			console.log("Error in Parsing JSON repsonse from server: " + err);
		    }finally{
			this.success = true;
			eventEmitter.emit('responseCatch', this.response_body);
		    }
		}
	    });
	    callback(null);
	});
	
	/**
	 * In case of a no connection error the callback function is used for 
	 * sending Problem with WURFL Cloud request following by the appropriate error.
	 */
	this.req.on('error', function(e) {
	    console.log('Problem with WURFL Cloud request: ' + e.message);
	    callback('Problem with WURFL Cloud request: ' + e.message);
	});
	this.req.end();
    }	
};


exports.callWurflServer = callWurflServer;
exports.eventEmitter = eventEmitter;