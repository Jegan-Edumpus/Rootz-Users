const express = require("express");

const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router({ mergeParams: true });
const { getAllInterests } = require("../controllers/interest");

/* verify token */
router.use(verifyToken);

router.route("/").get(async(getAllInterests));

module.exports = router;
