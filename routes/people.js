const express = require("express");

const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const {
  premiumUsers,
  discoverUsers,
  userDetails,
} = require("../controllers/people");
const router = express.Router({ mergeParams: true });

/* verify token */
router.use(verifyToken);

router.get("/premium-users", async(premiumUsers));

router.get("/discover-users", async(discoverUsers));

router.get("/details/:id", async(userDetails));

module.exports = router;
