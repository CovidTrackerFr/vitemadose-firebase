const admin = require('firebase-admin');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.


exports.sendNotification = function sendNotification(title, body, department, center, url, topic, type) {
	var message = {
      	data: {
			title: title,
      		body: body,
      		department: department,
      		center: center,
      		url: url,
      		topic: topic,
      		type: type
    	},
     	apns: {
     		payload: {
     			aps: {
     				alert: {
          				title: title,
          				body: body
      				},
      				sound: "default"
     			}
     		}
     		
     	},
      	webpush: {
      		notification: {
      			title: title,
      			body: body
      		},
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