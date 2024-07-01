const express = require("express");
const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const {
  userDetails,
  chatUserDetails,
} = require("../controllers/eventController");
const router = express.Router({ mergeParams: true });

/* verify token */
router.use(verifyToken);

router.route("/users").post(async(userDetails));

router.route("/chat-users").post(async(chatUserDetails));

module.exports = router;
