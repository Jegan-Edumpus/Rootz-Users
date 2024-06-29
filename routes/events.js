const express = require("express");
const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const { userDetails } = require("../controllers/eventController");
const router = express.Router({ mergeParams: true });

/* verify token */
router.use(verifyToken);

router.route("/users").post(async(userDetails));

module.exports = router;
