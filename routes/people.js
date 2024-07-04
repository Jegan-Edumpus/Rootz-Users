const express = require("express");

const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const {
  premiumUsers,
  discoverUsers,
  userDetails,
  searchUsers,
  blockUser,
  unblockUser,
  reportUser,
} = require("../controllers/people");
const router = express.Router({ mergeParams: true });

/* verify token */
router.use(verifyToken);

router.get("/premium-users", async(premiumUsers));

router.get("/discover-users", async(discoverUsers));

router.get("/search-users", async(searchUsers));

router.post("/block-user", async(blockUser));

router.post("/unblock-user", async(unblockUser));

router.post("/report-user", async(reportUser));

router.get("/details/:id", async(userDetails));

module.exports = router;
