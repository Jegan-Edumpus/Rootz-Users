const express = require("express");

const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router({ mergeParams: true });
const {
  profileDetails,
  updateName,
  updateInterests,
  uploadProfileImage,
  updateAbout,
  updateGender,
  updateDOB,
  checkMobileExist,
  updateWhatsappNumber,
  enableProfileChat,
  getAllCities,
  getAllLanguages,
  updateLocationDetails,
  updateMobileNumber,
  blockedList,
  addDeviceToken,
  removeDeviceToken,
  addFeedback,
} = require("../controllers/profile");
const { uploadImage } = require("../middleware/s3Upload");

/* verify token */
router.use(verifyToken);

router.route("/languages").get(async(getAllLanguages));

router.route("/all-cities").get(async(getAllCities));

router.route("/verify-mobile").post(async(checkMobileExist));

router.route("/:id").get(async(profileDetails));

router.route("/:id/update-interests").patch(async(updateInterests));

router.route("/:id/update-name").patch(async(updateName));

router.route("/:id/upload-image").patch(uploadImage, async(uploadProfileImage));

router.route("/:id/update-about").patch(async(updateAbout));

router.route("/:id/update-gender").patch(async(updateGender));

router.route("/:id/update-dob").patch(async(updateDOB));

router.route("/:id/update-whatsapp").patch(async(updateWhatsappNumber));

router.route("/:id/update-profile-chat").patch(async(enableProfileChat));

router.route("/:id/update-geolocation").patch(async(updateLocationDetails));

router.route("/:id/update-mobile").post(async(updateMobileNumber));

router.route("/:id/blocked-list").get(async(blockedList));

router.route("/:id/add-deviceToken").post(async(addDeviceToken));

router.route("/:id/remove-deviceToken").post(async(removeDeviceToken));

router.route("/:id/add-feedback").post(async(addFeedback));

// router.route("/report-user").post(async(reportUser));

// router.route("/delete-account").delete(async(deleteAccount));

// router.route("/block-user").post(async(blockUser));

// router.route("/unblock-user").post(async(unBlockUser));

module.exports = router;
