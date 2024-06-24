const { initializeApp, cert } = require("firebase-admin/app");
const auth = require("firebase-admin/auth");
const serviceJson = require("../services/google-service.json");
initializeApp({ credential: cert(serviceJson) }); // Initialize app with firebase json file

const verifyFirebase = (token) => {
  return new Promise((resolve, reject) => {
    auth
      .getAuth()
      .verifyIdToken(token)
      .then((claims) => {
        return resolve(claims);
      })
      .catch((err) => {
        return reject(err);
      });
  });
};

module.exports = verifyFirebase;
