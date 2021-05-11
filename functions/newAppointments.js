const admin = require('firebase-admin');
const network = require('./network');
const notification = require('./notification');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

const notificationType = "new_appointments"

// Check availabilities for department
exports.checkDepartment = function checkDepartment(department) {
	const promises = [
		network.getDepartmentCenters(department), 
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

				departmentPromises.push(sendDepartmentNotification(
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

			var log = "[" + center.departement + " - " + center.internal_id + "] " 
				+ lastAppointmentCount + " -> " + appointmentCount + " available appointments : "

			if (typeof lastAppointmentCount != 'number' || lastAppointmentCount > 0 || appointmentCount == 0) {
				console.info(log + "notification not necessary");

				return saveCenterState(center);
			} else {
				console.info(log + "send notification");

				return exports.sendCenterNotification(center)
					.then(results => {
						return saveCenterState(center);
					});
			}
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
		.ref("/departments/" + center.departement + "/centers/" + center.internal_id + "/appointmentCount")
		.once('value')
		.then(snapshot => {
  			return snapshot.val();
		});
}

// Save center availabilities to database
function saveCenterState(center) {
	return admin
		.database()
		.ref("/departments/" + center.departement + "/centers/" + center.internal_id)
		.set({
			appointmentCount: center.appointment_count,
			lastScanWithAvailabilities: center.last_scan_with_availabilities
		});
}


//
// Notification functions
//

exports.sendCenterNotification = function sendCenterNotification(center) {
	var topic = "department_" + center.departement + "_center_" + center.internal_id;
	var title = getNotificationTitle(center.appointments);
	var body = center.nom;

	return notification.sendNotification(title, body, center.departement, center.internal_id, topic, notificationType);
}

function sendDepartmentNotification(departmentCode, departmentName, availableCenters) {
	var topic = "department_" + departmentCode;
	var title = getNotificationTitle(availableCenters);
	var body = departmentCode + " - " + departmentName;

	return notification.sendNotification(title, body, departmentCode, "", topic, notificationType);
}

function getNotificationTitle(appointmentCount) {
	if (appointmentCount > 1) {
		return "💉 Créneaux disponibles 💉";
	} else {
		return "💉 Créneau disponible 💉";
	}
}