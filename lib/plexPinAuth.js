const request = require('request-promise');
const xml = require('fast-xml-parser')
const headers = require('plex-api-headers');


/**
 * The constructor for PlexPinAuth.
 *
 * @class PlexPinAuth
 * @param {PlexApi}		PlexApi
 * @returns {PlexPinAuth}
 * @constructor
 */
var PlexPinAuth = function(plexApi)
{
	if (!(this instanceof PlexPinAuth))
		return new PlexPinAuth(plexApi);

	this.plexApi = plexApi;
	this.tokens = {};
	
	if (!this.plexApi)
		throw new Error('Please check the arguments!');
};

/**
 * This function requests a new pin.
 *
 * @param void
 * @returns {Promise<Object>}
 */
PlexPinAuth.prototype.getPin = function()
{
	return request.post({
		url: 'https://plex.tv/pins.xml',
		headers: headers(this.plexApi)
	})
		.then(res =>
		{
			let response;
			try
			{
				response = xml.parse(res);
				response.pin.token = null;
				response.pin.status = 'RETRIEVED_CODE';
				return response.pin;
			}
			catch(err) {throw err}
		})
		.catch(err => {throw err});
};

/**
 * This function retrieves the token based on a pin.
 *
 * @param {number}		pin			PIN
 * @returns {Promise<Object>}
 */
PlexPinAuth.prototype.getToken = function(pin)
{
	// retrieve from cache
	if (this.tokens[pin])
	{
		return Promise.resolve({
			'token': true,
			status: 'RETRIEVED_TOKEN',
			'auth_token': this.tokens[pin]
		});
	}
	
	// no cache, thus retrieve online
	return request.get({
        url: 'https://plex.tv/pins/' + pin + '.xml',
		headers: headers(this.plexApi)
	})
		.then(res =>
		{
			let response;
			try
			{
				
				response = xml.parse(res);
				response.pin.token = null;
				response.pin.status = 'RETRIEVING_TOKEN';
				
				// check for timeout
				if (new Date().toISOString() >= response.pin['expires-at'])
				{
					response.pin.token = false;
					response.pin.status = 'TIMEOUT_TOKEN';
				}
				
				// token retrieved
				if (response.pin['auth-token'])
				{
					response.pin.token = true;
					response.pin.status = 'RETRIEVED_TOKEN';
					this.tokens[pin] = response.pin['auth-token'];
				}
				
				return response.pin;
			}
			catch(err) {throw err}
		})
		.catch(err => {throw err});
};


module.exports = PlexPinAuth;