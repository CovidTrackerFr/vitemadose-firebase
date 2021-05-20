const admin = require('firebase-admin');
const network = require('./network');
const notification = require('./notification');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

const notificationTopicSuffix = "_chronodoses"
const notificationType = "chronodoses"

// Check chronodoses for department
exports.checkDepartment = function checkDepartment(department) {
	const promises = [
		network.getDepartmentCenters(department), 
		getLastDepartmentState(department.code_departement)
	];

	return Promise.all(promises)
		.then(results => {
			const centers = results[0].centers;
			const lastChronodoseCount = results[1];

			var chronodoseCount = 0;
			for (let center of centers) {
				chronodoseCount += getAvailableChronodosesForCenter(center);
			}

			var log = "[" + department.code_departement + " - " + department.nom_departement + "] " 
				+ lastChronodoseCount + " -> " + chronodoseCount + " chronodoses : "

			var departmentPromises =  [];

			if (typeof lastChronodoseCount != 'number' || lastChronodoseCount > 0 || chronodoseCount == 0) {
				console.info(log + "notification not necessary");

				departmentPromises.push(saveDepartmentState(department.code_departement, chronodoseCount));
			} else if (chronodoseCount == 1) {
				console.info(log + "notification not necessary for only 1 dose");
				// do not save this state, if the next state is greater than 1 dose, 
				// we want to notify this department, so we must keep the reference of the transition from 0 dose
			} else {
				console.info(log + "send notification");

				departmentPromises.push(sendDepartmentNotification(
					department.code_departement, 
					department.nom_departement, 
					chronodoseCount)
					.then(results => {
						return saveDepartmentState(department.code_departement, chronodoseCount);
					}));
			}


			for (let center of centers) {
				departmentPromises.push(checkCenter(center));
			}

			return Promise.all(departmentPromises)
		});
}

// Check chronodoses for center
function checkCenter(center) {
	return getLastCenterState(center)
		.then(result => {
			const lastChronodoseCount = result;
			const chronodoseCount = getAvailableChronodosesForCenter(center);

			var log = "[" + center.departement + " - " + center.internal_id + "] " 
				+ lastChronodoseCount + " -> " + chronodoseCount + " chronodoses : "

			if (typeof lastChronodoseCount != 'number' || lastChronodoseCount > 0 || chronodoseCount == 0) {
				console.info(log + "notification not necessary");

				return saveCenterState(center, chronodoseCount);
			} else if (chronodoseCount == 1) {
				console.info(log + "notification not necessary for only 1 dose");
				// do not save this state, if the next state is greater than 1 dose, 
				// we want to notify this center, so we must keep the reference of the transition from 0 dose
				return;
			} else {
				console.info(log + "send notification");

				return exports.sendCenterNotification(center, chronodoseCount)
					.then(results => {
						return saveCenterState(center, chronodoseCount);
					});
			}
		});
}

// Check chronodose count for center
function getAvailableChronodosesForCenter(center) {
	try {
		if (center.appointment_schedules) {
			for (let schedule of center.appointment_schedules) {
				if (schedule.name == "chronodose") {
					return schedule.total;
				}
			}
		}
	} catch {
		// ignore
	}
	
	return 0;
}

//
// Database functions
//

// Get departement last chronodoses from database
function getLastDepartmentState(departmentCode) {
	return admin
		.database()
		.ref("/departments/" + departmentCode + "/chronodoseCount")
		.once('value')
		.then(snapshot => {
  			return snapshot.val();
		});
}

// Save departement chronodoses to database
function saveDepartmentState(departmentCode, chronodoseCount) {
	return admin
		.database()
		.ref("/departments/" + departmentCode)
		.update({
			chronodoseCount: chronodoseCount
		});
}

// Get center last chronodoses from database
function getLastCenterState(center) {
	return admin
		.database()
		.ref("/departments/" + center.departement + "/centers/" + center.internal_id + "/chronodoseCount")
		.once('value')
		.then(snapshot => {
  			return snapshot.val();
		});
}

// Save center chronodoses to database
function saveCenterState(center, chronodoseCount) {
	return admin
		.database()
		.ref("/departments/" + center.departement + "/centers/" + center.internal_id)
		.update({
			chronodoseCount: chronodoseCount
		});
}


//
// Notification functions
//

exports.sendCenterNotification = function sendCenterNotification(center, availableChronodoses) {
	var topic = "department_" + center.departement + "_center_" + center.internal_id + notificationTopicSuffix;
	var title = getNotificationTitle(availableChronodoses);
	var body = center.nom;

	return notification.sendNotification(title, body, center.departement, center.internal_id, center.url, topic, notificationType);
}

function sendDepartmentNotification(departmentCode, departmentName, availableCenters) {
	var topic = "department_" + departmentCode + notificationTopicSuffix;
	var title = getNotificationTitle(availableCenters);
	var body = departmentCode + " - " + departmentName;

	return notification.sendNotification(title, body, departmentCode, "", "", topic, notificationType);
}

function getNotificationTitle(appointmentCount) {
	if (appointmentCount > 1) {
		return "⚡ Chronodoses disponibles ⚡";
	} else {
		return "⚡ Chronodose disponible ⚡";
	}
}