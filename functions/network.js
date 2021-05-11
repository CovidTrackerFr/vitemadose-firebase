const request = require('request-promise');

const baseUrl = "https://vitemadose.gitlab.io/vitemadose/"
const departmentsUrl = baseUrl + "departements.json"


//
// Network VMD functions
//

// Request departements
exports.getDepartments = function getDepartments() {
  return httpGet(departmentsUrl)
    .then(departments => {
      console.info(departments.length + " departments found");

      return departments;
    });
}

// Request departement availabilities
exports.getDepartmentCenters = function getDepartmentCenters(department) {
  return httpGet(baseUrl + department.code_departement + ".json")
    .then(result => {
      return {
        lastUpdated: result.last_updated,
        centers: result.centres_disponibles.concat(result.centres_indisponibles),
        availableCentersCount: result.centres_disponibles.length
      };
    });
}



//
// Network functions
//

function httpGet(url) {
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