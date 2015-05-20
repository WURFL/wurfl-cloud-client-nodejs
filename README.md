# ScientiaMobile WURFL Cloud Client for Node.js

The WURFL Cloud Service by ScientiaMobile, Inc., is a cloud-based
mobile device detection service that can quickly and accurately
detect over 500 capabilities of visiting devices.  It can differentiate
between portable mobile devices, desktop devices, SmartTVs and any 
other types of devices that have a web browser.

This is the Node.js Client for accessing the WURFL Cloud Service, and
it requires a free or paid WURFL Cloud account from ScientiaMobile:
http://www.scientiamobile.com/cloud 

## Installation
--------------
### Requirements
- Node.JS version 0.8.2

### Sign up for WURFL Cloud
First, you must go to http://www.scientiamobile.com/cloud and signup
for a free or paid WURFL Cloud account (see above).  When you've finished
creating your account, and have selected the WURFL Capabilities that you
would like to use, you must copy your API Key, as it will be needed in
the Client.

### Installation

**Via npm:**

    $ npm install wurflcloud

**Via Source:**

[Download the source code](https://github.com/WURFL/wurfl-cloud-client-nodejs/zipball/master) and
include the following lines in your code:

   	var wurfl_cloud_client = require("./NodeWurflCloudClient/WurflCloudClient");
	var config = require("./NodeWurflCloudClient/Config");

### Configuration
Set your API Key:

   	var api_key = "XXXXXX:YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY";
	var configuration = new config.WurflCloudConfig(api_key);

### Example
After you have installed and configured the WURFL Client, create example.js:

	var brand;
	var result_capabilities = {};
	var WURFLCloudClientObject = new wurfl_cloud_client.WurflCloudClient(configuration, HttpRequest, HttpResponse);
	WURFLCloudClientObject.detectDevice(HttpRequest, null, function(err, result_capabilities){
		WURFLCloudClientObject.getDeviceCapability('brand_name', function(error, brand){
			if(error!=null){
				console.log('Error' + error);
			}else{
				console.log('Brand name: ' + brand);
			}
		});
	});				

You should see the brand name of your device in the console provided
that you have already obtained a WURFL Cloud API key and that you have
selected `brand_name` in your capabilities section.


### Example application
After you have registered in WURFL Cloud Service [here](http://www.scientiamobile.com/cloud),
to run the example application on you browser do the following:

* Download and extract all the files in a folder.
* Inside the `exampleApp.js` enter your own WURFL Cloud api key.
* Select `brand_name` and `is_wireless_device` as your capabilities in ScientiaMobile WURFL Cloud website.
* Run the `server/example` application inside a console with `node index.js`.
* Go to a Web Browser in `http://localhost:8888`
* Either chose `example` or `example2`.

You will see the brand name of your device and whether it is wireless or not.


**2015 ScientiaMobile Incorporated**

**All Rights Reserved.**

**NOTICE**:  All information contained herein is, and remains the property of
ScientiaMobile Incorporated and its suppliers, if any.  The intellectual
and technical concepts contained herein are proprietary to ScientiaMobile
Incorporated and its suppliers and may be covered by U.S. and Foreign
Patents, patents in process, and are protected by trade secret or copyright
law. Dissemination of this information or reproduction of this material is
strictly forbidden unless prior written permission is obtained from 
ScientiaMobile Incorporated.
