const express = require("express");
const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router({ mergeParams: true });
const versionHandler = require("../middleware/versionHandler");
const { registerUser, verifyUser } = require("../controllers/auth");
const { uploadImage } = require("../middleware/s3Upload");

/* Verify token middleware */
router.use(verifyToken);

/* verify partner user */
router.post("/verify", async(verifyUser));

/* register new partner user */
router.post("/register", uploadImage, async(registerUser));

module.exports = router;
