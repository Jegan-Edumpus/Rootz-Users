const DB = require("../config/DB");
const createError = require("http-errors");
const generateSignedUrl = require("../utils/generateSignedUrl");
const generateUniqueId = require("../utils/generateUniqueId");

/* Get user profile details */
const profileDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("id param", id);
    const [profile] = await DB.query(
      `select users.id, profile_id, name, mobile, country_code, dob, gender, about, interests, image, user_block.blocked, user_location.latitude, user_location.longitude, user_location.city, user_location.country, user_location.cca3, user_settings.enable_whatsapp, user_settings.profile_chat, user_settings.status, user_notification.device_arns from users left join user_location on users.id = user_location.user_id left join user_settings on users.id = user_settings.user_id left join user_notification on users.id = user_notification.user_id left join (SELECT user_id, GROUP_CONCAT(blocked_to) AS blocked FROM user_block WHERE deleted_at IS NULL GROUP BY user_id) user_block on users.id = user_block.user_id where users.id = ? and users.deleted_at is null`,
      [id]
    );

    if (profile?.length) {
      const { blocked, image } = profile[0];
      const signedUrl = await generateSignedUrl(image);

      if (!profile[0]?.profile_id) {
        const profileID = generateUniqueId();
        await DB.query("UPDATE users SET profile_id=? WHERE id=?", [
          profileID,
          id,
        ]);
      }
      return res.status(200).json({
        profileDetails: {
          ...profile[0],
          image: signedUrl,
          blocked: blocked && blocked !== "NULL" ? blocked.split(",") : [],
        },
      });
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update user interests */
const updateInterests = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { interests } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }
    if (!interests || interests.length === 0) {
      return next(createError(400, "Interests required"));
    }

    const [checkUser] = await DB.query(
      "select id from users where id=? and deleted_at is null",
      [id]
    );

    if (checkUser.length) {
      const [profileDetails] = await DB.query(
        "UPDATE users SET interests=? WHERE id=? and deleted_at is null",
        [JSON.stringify(interests), id]
      );

      if (profileDetails.affectedRows) {
        return res
          .status(200)
          .json({ message: "Interests updated successfully" });
      } else {
        return next(createError(400, "Unable to update interests"));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update user profile image */
const uploadProfileImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(createError(400, "User ID required"));
    }
    if (req?.file?.location) {
      // console.log("req.file", req.file);
      const [userDetails] = await DB.query(
        "select id from users where id=? and deleted_at is null",
        [id]
      );

      if (userDetails?.length) {
        /* Get image url from s3 object */
        const image = req?.file?.location
          ?.split("amazonaws.com/")[1]
          ?.replace(/%2F/g, "/");

        const [profileDetails] = await DB.query(
          "update users set image=? where id=? and deleted_at is null",
          [image, id]
        );

        if (profileDetails.affectedRows) {
          const signedUrl = await generateSignedUrl(image);
          return res.status(200).json({
            message: "Profile image uploaded successfully",
            signedUrl,
          });
        } else {
          return next(createError(400, "Unable to upload profile image"));
        }
      } else {
        return next(createError(404, "Account not found"));
      }
    } else {
      return next(createError(400, "Unable to upload profile image"));
    }
  } catch (error) {
    console.log("upload error", error);
    return next(createError(500, error));
  }
};

/* Update user display name */
const updateName = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!name) {
      return next(createError(400, "Name is required"));
    }

    /* check user name is already exist */
    const [checkName] = await DB.query(
      "select id from users where name=? and deleted_at is null",
      [name]
    );

    if (checkName?.length) {
      return next(createError(409, "User name already exist"));
    } else {
      const [profileDetails] = await DB.query(
        "UPDATE users SET name=? WHERE id=? and deleted_at is null",
        [name, id]
      );

      if (profileDetails.affectedRows) {
        return res.status(200).json({ message: "Name updated successfully" });
      } else {
        return next(createError(404, "Account not found"));
      }
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

module.exports = {
  profileDetails,
  updateName,
  uploadProfileImage,
  updateInterests,
};
