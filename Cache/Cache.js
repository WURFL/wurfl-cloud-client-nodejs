/**
 * This software is the Copyright of ScientiaMobile, Inc.
 * 
 * Please refer to the LICENSE.txt file distributed with the software for licensing information.
 * 
 * @package NodeWurflCloudClient
 */

var libraries = require("../Libraries/libs");
var base64 = require("../Libraries/encode_base64");

//constructor
var WurflCloud_CacheNode = function(request, response){
    this.request = request;
    this.response = response;
    this.cookie_name = 'NodeWurflCloud_Client';
    this.cache_expiration = 86400;
    this.cookie_sent = false;
    this.cookies = {};
    this.data = {};
    this.result = false;
    this.lastModified = null
}

WurflCloud_CacheNode.prototype = {
    cookie_name: 'NodeWurflCloud_Client',
    cache_expiration : 86400,
    cookie_sent: false,
    cookies: {},
    data: {},
    result: false,
    request: null,
    response: null,
    lastModified: null,

    /**
     * Get the device capabilities for the given request from the cache provider
     * @param request, http_request
     * @saves in results the available capabilities found in cache
     */
    getDevice: function(request, callback) {
        var cookie_data = null;
        if (typeof request.headers.cookie !== 'undefined') {
            temp = request.headers.cookie.split(';');
            for(var i=0;i<temp.length;i++){
            var parts = temp[i].split('=');
            this.cookies[parts[ 0 ].trim()] = ( parts[ 1 ] || '' ).trim();
            }
        }else{
            this.result = false;
            return callback();
        }

        //checking for the appropriate WURFL Cloud cookie
        if (typeof this.cookies[this.cookie_name] === 'undefined') {
            this.result = false;
            return callback();
        }
        //checking the validity of the cookie
        cookie_data = base64.Base64.decode(JSON.stringify(this.cookies[this.cookie_name]));
        var n = cookie_data.indexOf("}}"); //end of cookie_data

        this.data = JSON.parse(cookie_data.trim().slice(0,cookie_data.length - cookie_data.length + n +2 ));
        if (cookie_data.length === 0){
            this.result = false;
            return callback();
        }
        if (cookie_data.date_set + this.cache_expiration < Math.floor(new Date().getTime() / 1000)){
            this.result = false;
            return callback();
        }
        if (!this.data.capabilities || this.data.capabilities.length === 0){
            this.result = false;
            return callback();
        }
        this.result = this.data.capabilities;
        return callback();
    },
    /**
     * Stores the given user agent with the given device capabilities in the cache provider for the given time period
     * @param array capabilities
     * Creates and stores the cookie in the http_response
     */
    setDevice: function(user_agent, capabilities){
    console.log("SET_DEVICE is called!");
        if (this.cookie_sent === true)
            return;
        var cookie_data={
            'date_set': Math.floor(new Date().getTime() / 1000),
            'capabilities': capabilities
        }
        var encoded_cookie_data = base64.Base64.encode(JSON.stringify(cookie_data));
        this.cookie_sent = true;
        try{
            //set e cookie for a day (expiration in one day)
            this.response.setHeader("Set-Cookie", this.cookie_name +'='+ encoded_cookie_data +';' + 'expires='+new Date(new Date().getTime()+ this.cache_expiration * 1000 ).toUTCString());
            this.lastModified = new Date().getTime() / 1000;
        }catch(err){
            this.cookie_sent = false;
            return console.log("Error with the header of the Cookie!" + err);
        }
    },

    getReportAge: function(temp, callback){
        return callback(null, null);
    }
}

exports.WurflCloud_CacheNode = WurflCloud_CacheNode;