const express = require("express");
const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const {
  userDetails,
  chatUserDetails,
  sendPushNotification,
  getblockedUserDetails,
} = require("../controllers/eventController");
const router = express.Router({ mergeParams: true });

/* verify token */
router.use(verifyToken);

router.route("/users").post(async(userDetails));

router.route("/getblockedUserDetails").get(async(getblockedUserDetails));
router.route("/chat-users").post(async(chatUserDetails));
router.route("/push-notifications").post(async(sendPushNotification));

module.exports = router;
