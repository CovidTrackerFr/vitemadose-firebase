const functions = require('firebase-functions');
const admin = require('firebase-admin');
const network = require('./network');
const cors = require('cors')({origin: true});
const notification = require('./notification');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

const baseUrl = "https://vitemadose.gitlab.io/vitemadose/"
const departmentsUrl = baseUrl + "departements.json"


const runtimeOpts = {
  timeoutSeconds: 300,
  memory: '1GB'
}


// Firebase function
exports.checkNewAppointments = functions
    .runWith(runtimeOpts)
    .region('europe-west1')
    .pubsub
    .schedule('every 15 minutes from 08:00 to 22:00')
    .timeZone('Europe/Paris')
    .onRun((context) => {
	 	return getDepartments()
		  	.then(departments => {
		  		var checkDepartmentPromises = [];
				for (let department of departments) {
					checkDepartmentPromises.push(checkDepartment(department));
				}

				return Promise.all(checkDepartmentPromises);
		  	});
});

// Firebase web push function
exports.subscribeToTopic = functions
    .region('europe-west1')
    .https
    .onRequest((req, res) => {
    	cors(req, res, () => {
	    	const registrationTokens = [req.query.token];
	    	const topic = req.query.topic;

	    	return admin
	    		.messaging()
	    		.subscribeToTopic(registrationTokens, topic)
	  			.then(function(response) {
					// See the MessagingTopicManagementResponse reference documentation
					// for the contents of response.
					console.log('Successfully subscribed to topic:', response);

	          		res.status(200).send();
				})
				.catch(function(error) {
					console.log('Error subscribing to topic:', error);
	          		res.status(500).send();
				});
		});
    });

exports.unsubscribeFromTopic = functions
    .region('europe-west1')
    .https
    .onRequest((req, res) => {
    	cors(req, res, () => {
	    	const registrationTokens = [req.query.token];
	    	const topic = req.query.topic;

	    	return admin
	    		.messaging()
	    		.unsubscribeFromTopic(registrationTokens, topic)
	  			.then(function(response) {
					// See the MessagingTopicManagementResponse reference documentation
					// for the contents of response.
					console.log('Successfully unsubscribed from topic:', response);

	          		res.status(200).send();
				})
				.catch(function(error) {
					console.log('Error unsubscribing from topic:', error);
	          		res.status(500).send();
				});
		});
    });

exports.sendNotification = functions
    .region('europe-west1')
    .https
    .onRequest((req, res) => {
    	cors(req, res, () => {

    		const center = {
    			gid: req.query.centerId,
    			nom: "Centre de test " + req.query.centerId,
    			departement: req.query.department,
    			appointments: 3,
    		}
			return notification.sendCenterNotification(center)
	  			.then(function(response) {
	          		res.status(200).send();
				})
				.catch(function(error) {
	          		res.status(500).send();
				});
		});
    });


// Check availabilities for department
function checkDepartment(department) {
	const promises = [
		getDepartmentCenters(department), 
		getLastDepartmentState(department.code_departement)
	];

	return Promise.all(promises)
		.then(results => {
			const lastUpdated = results[0].lastUpdated;
			const centers = results[0].centers;
			const availableCenters = results[0].availableCentersCount;
			const lastAvailableCenters = results[1];

			var log = "[" + department.code_departement + " - " + department.nom_departement + "] " 
				+ lastAvailableCenters + " -> " + availableCenters + " available centers : "

			var departmentPromises =  [];

			if (typeof lastAvailableCenters != 'number' || lastAvailableCenters > 0 || availableCenters == 0) {
				console.info(log + "notification not necessary");

				departmentPromises.push(saveDepartmentState(department.code_departement, availableCenters, lastUpdated, false));
			} else {
				console.info(log + "send notification");

				departmentPromises.push(notification.sendDepartmentNotification(
					department.code_departement, 
					department.nom_departement, 
					availableCenters)
					.then(results => {
						return saveDepartmentState(department.code_departement, availableCenters, lastUpdated, true);
					}));
			}


			for (let center of centers) {
				departmentPromises.push(checkCenter(center));
			}

			return Promise.all(departmentPromises)
		});
}

// Check availabilities for center
function checkCenter(center) {
	return getLastCenterState(center)
		.then(result => {
			const lastAppointmentCount = result;
			const appointmentCount = center.appointment_count;

			var log = "[" + center.departement + " - " + center.gid + "] " 
				+ lastAppointmentCount + " -> " + appointmentCount + " available appointments : "

			if (typeof lastAppointmentCount != 'number' || lastAppointmentCount > 0 || appointmentCount == 0) {
				console.info(log + "notification not necessary");

				return saveCenterState(center);
			} else {
				console.info(log + "send notification");

				return notification.sendCenterNotification(center)
					.then(results => {
						return saveCenterState(center);
					});
			}
		});
	
}

//
// Network functions
//

// Request departements
function getDepartments() {
	return network.httpGet(departmentsUrl)
		.then(departments => {
			console.info(departments.length + " departments found");

			return departments;
		});
}

// Request departement availabilities
function getDepartmentCenters(department) {
	return network.httpGet(baseUrl + department.code_departement + ".json")
		.then(result => {
			return {
				lastUpdated: result.last_updated,
				centers: result.centres_disponibles.concat(result.centres_indisponibles),
				availableCentersCount: result.centres_disponibles.length
			};
		});
}


//
// Database functions
//

// Get departement last availabilities from database
function getLastDepartmentState(departmentCode) {
	return admin
		.database()
		.ref("/departments/" + departmentCode + "/availableCenters")
		.once('value')
		.then(snapshot => {
  			return snapshot.val();
		});
}

// Save departement availabilities to database
function saveDepartmentState(departmentCode, availableCenters, lastUpdated, notificationSent) {
	return admin
		.database()
		.ref("/departments/" + departmentCode)
		.update({
			availableCenters: availableCenters,
			lastUpdated: lastUpdated
		});
}

// Get center last availabilities from database
function getLastCenterState(center) {
	return admin
		.database()
		.ref("/departments/" + center.departement + "/centers/" + center.gid + "/appointmentCount")
		.once('value')
		.then(snapshot => {
  			return snapshot.val();
		});
}

// Save center availabilities to database
function saveCenterState(center) {
	return admin
		.database()
		.ref("/departments/" + center.departement + "/centers/" + center.gid)
		.set({
			appointmentCount: center.appointment_count,
			lastScanWithAvailabilities: center.last_scan_with_availabilities
		});
}