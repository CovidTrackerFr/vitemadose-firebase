const admin = require('firebase-admin');
try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

exports.sendCenterNotification = function sendCenterNotification(center) {
	var topic = "department_" + center.departement + "_center_" + center.gid;
	var title = center.nom;
	var body;
	if (center.appointments > 1) {
		body = "Nouveaux créneaux disponibles";
	} else {
		body = "Nouveau créneau disponible";
	}
	var data = {
      	department: center.departement,
      	center: center.gid,
		title: title,
      	body: body
    }

	return sendNotification(title, body, data, topic);
}

exports.sendDepartmentNotification = function sendDepartmentNotification(departmentCode, departmentName, availableCenters) {
	var topic = "department_" + departmentCode;
	var title = departmentCode + " - " + departmentName;
	var body;
	if (availableCenters > 1) {
		body = "Nouveaux créneaux disponibles";
	} else {
		body = "Nouveau créneau disponible";
	}
	var data = {
      	department: departmentCode,
		title: title,
      	body: body
    }

	return sendNotification(title, body, data, topic);
}

function sendNotification(title, body, data, topic) {
	var message = {
      	data: data,
	  	topic: topic
	};

	// Send a message to devices subscribed to the provided topic.
	return admin.messaging()
		.send(message)
	  	.then((response) => {
	        // Response is a message ID string.
	        console.info('Successfully sent message to topic ' + topic + ':', response);
	  	})
	  	.catch((error) => {
	        console.error('Error sending message to topic ' + topic + ':', error);
	  	});
}