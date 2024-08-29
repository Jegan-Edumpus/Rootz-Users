const express = require("express");
const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const {
  userDetails,
  chatUserDetails,
  sendPushNotification,
  getblockedUserDetails,
  sendChatPushNotification,
  getBlockedUserIds,
  getAllAppUsers,
  getDashboardData,
  getCountryUsers,
  getAllAppUsersById,
  getAllSubscriptions,
} = require("../controllers/eventController");
const router = express.Router({ mergeParams: true });
router.route("/app_users").get(async(getAllAppUsers));
router.route("/dashdata").get(async(getDashboardData));
router.route("/country_users").get(async(getCountryUsers));
router.route("/appusersByID").get(async(getAllAppUsersById));
router.route("/getAllSubscriptions").get(async(getAllSubscriptions));
/* verify token */
router.use(verifyToken);

router.route("/users").post(async(userDetails));

router.route("/getblockedUserDetails").get(async(getblockedUserDetails));
router.route("/blocked-users").get(async(getBlockedUserIds));
router.route("/chat-users").post(async(chatUserDetails));
router.route("/push-notifications").post(async(sendPushNotification));
router.route("/chat-notifications").post(async(sendChatPushNotification));

module.exports = router;
