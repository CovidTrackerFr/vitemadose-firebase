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

	return sendNotification(title, body, center.departement, center.gid, topic);
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

	return sendNotification(title, body, departmentCode, "", topic);
}

function sendNotification(title, body, department, center, topic) {
	var message = {
      	data: {
			title: title,
      		body: body,
      		department: department,
      		center: center,
      		topic: topic
    	},
      	webpush: {
      		fcm_options: {
        		link: "https://vitemadose.covidtracker.fr/"
      		}
    	},
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