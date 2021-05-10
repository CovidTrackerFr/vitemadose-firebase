const functions = require('firebase-functions');
const admin = require('firebase-admin');
const network = require('./network');
const cors = require('cors')({origin: true});
const notification = require('./notification');
const newAppointments = require('./newAppointments');
const chronodose = require('./chronodose');

try {admin.initializeApp();} catch(e) {} // You do that because the admin SDK can only be initialized once.


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
	 	return network.getDepartments()
		  	.then(departments => {
		  		var checkDepartmentPromises = [];
				for (let department of departments) {
					checkDepartmentPromises.push(newAppointments.checkDepartment(department));
				}

				return Promise.all(checkDepartmentPromises);
		  	});
});

exports.checkChronoDoseAppointments = functions
    .runWith(runtimeOpts)
    .region('europe-west1')
    .pubsub
    .schedule('every day 16:00')
    .timeZone('Europe/Paris')
    .onRun((context) => {
	 	return network.getDepartments()
		  	.then(departments => {
		  		var checkDepartmentPromises = [];
				for (let department of departments) {
					checkDepartmentPromises.push(chronodose.checkDepartment(department));
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
    			internal_id: req.query.centerId,
    			nom: "Centre de test " + req.query.centerId,
    			departement: req.query.department,
    			appointments: 3,
    		}
			
			var notificationPromise;
			if (req.query.chronodose === "true") {
				notificationPromise = chronodose.sendCenterNotification(center, 2)
			} else {
				notificationPromise = newAppointments.sendCenterNotification(center)
			}

			return notificationPromise
	  			.then(function(response) {
	          		res.status(200).send();
				})
				.catch(function(error) {
	          		res.status(500).send();
				});
		});
    });
