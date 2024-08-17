const express = require("express");
const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router({ mergeParams: true });
// const versionHandler = require("../middleware/versionHandler");
const {
  registerUser,
  verifyUser,
  generateUserNames,
} = require("../controllers/auth");
const { uploadImage } = require("../middleware/s3Upload");

/* Verify token middleware */
router.use(verifyToken);

/* verify partner user */
router.get("/verify", async(verifyUser));

/* register new partner user */
router.post("/register", uploadImage, async(registerUser));

/* Generate user_names based on name field */
router.post("/generate-username", async(generateUserNames));

module.exports = router;
