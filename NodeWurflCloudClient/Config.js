/**
 * This software is the Copyright of ScientiaMobile, Inc.
 * 
 * Please refer to the LICENSE.txt file distributed with the software for licensing information.
 * 
 * @module NodeWurflCloudClient
 */
/**
 * Configuration class for the WURFL Cloud Client
 * 
 * A usage example of WurflCloudConfig:
 * <code>
 * // Paste your API Key below
 * var api_key = 'xxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
 * // Create a configuration object 
 * var config = new WurflCloudConfig(api_key); 
 * </code>
 * 
 * @module NodeWurflCloudClient
 */

var WurflCloudConfig = function(api_key, cache_host){
    this.api_key = api_key;
    this.http_timeout= 1000;
    this.compression= true;
    this.http_method= "WurflCloud_HttpClient";
    this.auto_purge= false;
    this.report_interval= 20000; //in miliSec
    this.api_type= "http";
    this.current_server= [],
    this.wcloud_servers= [
	{ nickname:"wurfl_cloud", url: "api.wurflcloud.com", weight: 80 }
    ];
}

WurflCloudConfig.prototype ={
    http_timeout: 1000,
    compression: true,
    http_method: "WurflCloud_HttpClient",
    auto_purge: false,
    report_interval: 60000, //in milliSec
    api_type: "http",
    api_key: null,
    current_server: [],
    wcloud_servers: [
	{ nickname:"wurfl_cloud", url: "api.wurflcloud.com", weight: 80 }
    ],

    /**
     * Adds the specified WURFL Cloud Server
     * @param string nickname Unique identifier for this server
     * @param string url URL to this server's API
     * @param int weight Specifies the chances that this server will be chosen over
     * the other servers in the pool.  This number is relative to the other servers' weights.
     */
    addCloudServer: function(nickname, url, weight){
	this.wcloud_servers.push({"nickname": nickname, "url": url, "weight":weight});
    },

    /**
     * Removes the WURFL Cloud Servers
     */
    clearServers: function(){
	this.wcloud_servers = {}
    },

    /**
     * Determines the WURFL Cloud Server that will be used and returns its URL.
     * @return string WURFL Cloud Server URL
     */
    getCloudHost: function(){
	var server = this.getWeightedServer();
	return server.url;
    },

    /**
     * Uses a weighted-random algorithm to chose a server from the pool
     * @return server in the literal object form: {nickname, url, weight}
     */
    getWeightedServer: function(){
	if(this.current_server.length === 1){
	    return this.current_server;
	}
	if(this.wcloud_servers.length === 1){
	    return this.wcloud_servers[0];
	}
	var max = rcount = 0;
	for (i=0; i< this.wcloud_servers.length; i++){
	    max += this.wcloud_servers[i].weight;
	}
	wrand = Math.floor((Math.random()*max)+1);
	k = 0;
	for (i=0; i< this.wcloud_servers.length; i++){
	    k = i;
	    if ( wrand <= (rcount += this.wcloud_servers[i].weight)) {
		break;
	    }
	}
	this.current_server = this.wcloud_servers[k];
	return this.current_server;
    }
};

exports.WurflCloudConfig = WurflCloudConfig;