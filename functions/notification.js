const admin = require('firebase-admin');
try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.

exports.sendDepartmentNotification = function sendDepartmentNotification(departmentCode, departmentName, availableCenters) {
	var topic = "department_" + departmentCode;
	var title = departmentCode + " - " + departmentName;
	var body;
	if (availableCenters > 1) {
		body = "Nouvelles disponibilités";
	} else {
		body = "Nouvelle disponibilité";
	}

	return sendNotification(title, body, topic);
}

function sendNotification(title, body, topic) {
	var message = {
		"notification":{
      		"title": title,
      		"body": body
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