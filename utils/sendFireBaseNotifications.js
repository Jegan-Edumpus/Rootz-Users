const { messaging } = require("firebase-admin");

const sendFirebaseNotification = async (device_token, data) => {
  const uniqueDeviceTokens = [...new Set(device_token)];
  // Send notifications to each token
  for (const token of uniqueDeviceTokens) {
    // Sending to a specific device
    data.token = token;

    try {
      const response = await messaging().send(data);
      console.log("Successfully sent message:", response);
    } catch (error) {
      console.log("Error sending message:", error);
    }
  }
};

module.exports = sendFirebaseNotification;
