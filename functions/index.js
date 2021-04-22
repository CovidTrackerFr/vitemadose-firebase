const functions = require('firebase-functions');
const admin = require('firebase-admin');
const network = require('./network');
const notification = require('./notification');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

const baseUrl = "https://vitemadose.gitlab.io/vitemadose/"
const departmentsUrl = baseUrl + "departements.json"


const runtimeOpts = {
  timeoutSeconds: 300,
  memory: '1GB'
}

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

				return Promise.all(checkDepartmentPromises)
					.then(results => {
						var availableCenters = 0;
						
						for (let result of results) {
							availableCenters += result
						}

		  				console.info(availableCenters + " centers available in France");
					});
		  	});
});

function checkDepartment(department) {
	const promises = [
		getDepartmentAvailableCenters(department), 
		getLastDepartmentState(department.code_departement)
	];

	return Promise.all(promises)
		.then(results => {
			const lastUpdated = results[0].lastUpdated;
			const availableCenters = results[0].availableCenters;
			const lastAvailableCenters = results[1] || 0;

			var log = "[" + department.code_departement + " - " + department.nom_departement + "] " 
				+ lastAvailableCenters + " -> " + availableCenters + " available centers : "

			if (lastAvailableCenters > 0 || availableCenters == 0) {
				console.info(log + "notification not necessary");

				return saveDepartmentState(department.code_departement, availableCenters, lastUpdated, false)
					.then(results => {
						return availableCenters;
					});
			} else {
				console.info(log + "send notification");

				return notification.sendDepartmentNotification(
					department.code_departement, 
					department.nom_departement, 
					availableCenters)
					.then(results => {
						return saveDepartmentState(department.code_departement, availableCenters, lastUpdated, true);
					})
					.then(results => {
						return availableCenters;
					});
			}
		});
}

function getDepartments() {
	return network.httpGet(departmentsUrl)
		.then(departments => {
			console.info(departments.length + " departments found");

			return departments;
		});
}

function getDepartmentAvailableCenters(department) {
	return network.httpGet(baseUrl + department.code_departement + ".json")
		.then(result => {
			return {
				"lastUpdated": result.last_updated,
				"availableCenters": result.centres_disponibles.length
			};
		});
}

function getLastDepartmentState(departmentCode) {
	return admin
		.database()
		.ref("/departments/" + departmentCode + "/availableCenters")
		.once('value')
		.then(snapshot => {
  			return snapshot.val();
		});
}

function saveDepartmentState(departmentCode, availableCenters, lastUpdated, notificationSent) {
	return admin
		.database()
		.ref("/departments/" + departmentCode)
		.set({
			"availableCenters": availableCenters,
			"lastUpdated": lastUpdated
		});
}