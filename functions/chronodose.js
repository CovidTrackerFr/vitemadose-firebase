const admin = require('firebase-admin');
const network = require('./network');
const notification = require('./notification');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

const notificationTopicSuffix = "_chronodoses"
const notificationType = "chronodoses"

// Check chronodose for department
exports.checkDepartment = function checkDepartment(department) {
	return network.getDepartmentCenters(department)
		.then(result => {
			const centers = result.centers;

			var availableChronodoses = 0;
			for (let center of centers) {
				availableChronodoses += getAvailableChronodosesForCenter(center);
			}

			var log = "[" + department.code_departement + " - " + department.nom_departement + "] " 
				+ availableChronodoses + " available chronodoses : "

			var departmentPromises =  [];

			if (availableChronodoses == 0) {
				console.info(log + "notification not necessary");
			} else {
				console.info(log + "send notification");

				departmentPromises.push(sendDepartmentNotification(
					department.code_departement, 
					department.nom_departement, 
					availableChronodoses));
			}


			for (let center of centers) {
				departmentPromises.push(checkCenter(center));
			}

			return Promise.all(departmentPromises)
		});
}

// Check availabilities for center
function checkCenter(center) {
	const availableChronodoses = getAvailableChronodosesForCenter(center);

	var log = "[" + center.departement + " - " + center.internal_id + "] " 
		+ availableChronodoses + " available chronodoses : "

	if (availableChronodoses == 0) {
		console.info(log + "notification not necessary");
	} else {
		console.info(log + "send notification");

		return exports.sendCenterNotification(center, availableChronodoses);
	}
}

// Check chronodose count for center
function getAvailableChronodosesForCenter(center) {
	if (center.appointment_schedules && center.appointment_schedules["2_days"]) {
		return center.appointment_schedules["2_days"];
	} else {
		return 0;
	}
	
}

//
// Notification functions
//

exports.sendCenterNotification = function sendCenterNotification(center, availableChronodoses) {
	var topic = "department_" + center.departement + "_center_" + center.internal_id + notificationTopicSuffix;
	var title = center.nom;
	var body = getNotificationBody(availableChronodoses);

	return notification.sendNotification(title, body, center.departement, center.internal_id, topic, notificationType);
}

function sendDepartmentNotification(departmentCode, departmentName, availableCenters) {
	var topic = "department_" + departmentCode + notificationTopicSuffix;
	var title = departmentCode + " - " + departmentName;
	var body = getNotificationBody(availableCenters);

	return notification.sendNotification(title, body, departmentCode, "", topic, notificationType);
}

function getNotificationBody(appointmentCount) {
	if (appointmentCount > 1) {
		return "Chronodoses disponibles";
	} else {
		return "Chronodose disponible";
	}
}