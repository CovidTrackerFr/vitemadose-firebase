const request = require('request-promise');

exports.httpGet = function httpGet(url) {
  return request({
      method: 'GET',
    	uri: url,
    	json: true,
    	resolveWithFullResponse: true
  	})
  	.then(response => {
    	if (response.statusCode === 200) {
        return response.body;
    	}
    	
      throw {
        url: url,
        body: response.body
  	  };
    });
}