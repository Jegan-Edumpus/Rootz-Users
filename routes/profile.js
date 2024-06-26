const express = require("express");

const { async } = require("../utils/asyncWrapper");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router({ mergeParams: true });
const {
  profileDetails,
  updateName,
  updateInterests,
  uploadProfileImage,
} = require("../controllers/profile");
const { uploadImage } = require("../middleware/s3Upload");

/* verify token */
router.use(verifyToken);

router.route("/:id").get(async(profileDetails));

router.route("/:id/update-interests").patch(async(updateInterests));

router.route("/:id/update-name").patch(async(updateName));

router.route("/:id/upload-image").patch(uploadImage, async(uploadProfileImage));

// router.route("/get-image").get(async(getProfileImages));

// router.route("/update-mobile").post(async(updateMobileNumber));

// router.route("/verify-mobile").post(async(checkMobileExist));

// router.route("/update-interests").post(async(updateInterests));

// router.route("/update-primary-image").post(async(setPrimaryImage));

// router.route("/remove-image").post(async(removeImage));

// router.route("/update-whatsapp").post(async(updateWhatsappNumber));

// router.route("/delete-account").delete(async(deleteAccount));

// router.route("/profile-chat").post(async(enableProfileChat));

// router.route("/add-deviceToken").post(async(addDeviceToken));

// router.route("/remove-deviceToken").post(async(removeDeviceToken));

// router.route("/all-cities").get(async(getAllCities));

// router.route("/languages").get(async(getAllLanguages));

// router.route("/block-user").post(async(blockUser));

// router.route("/unblock-user").post(async(unBlockUser));

// router.route("/blocked-list").get(async(blockedList));

// router.route("/get-geolocation").post(async(getLocationDetails));

// router.route("/report-user").post(async(reportUser));

// router.route("/add-feedback").post(async(feedback));

// router.route("/edit-profile-name-age").post(async(editProfileNameAge));

// router.route("/edit-about").post(async(editAbout));

// router.route("/edit-gender").post(async(editGender));

// router.route("/edit-preferred-gender").post(async(updatePreferredGender));

module.exports = router;
