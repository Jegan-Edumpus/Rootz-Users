const DB = require("../config/DB");
const createError = require("http-errors");

/* Get userdetails by ID */
const userDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (id?.length === 0) {
      return res.json({
        statusCode: 400,
        error: "User IDs required",
      });
    }

    console.log("id", id);
    const [userDetails] = await DB.query(
      "select users.id, name, dob, image, user_location.country from users left join user_location on users.id = user_location.user_id where users.id in (?) and users.deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      /* Return ordered user details */
      const orderedUserDetails = id.map((userId) =>
        userDetails.find((user) => user.id === Number(userId))
      );
      console.log("orderedUserDetails", orderedUserDetails);
      return res.json({
        statusCode: 200,
        userDetails: orderedUserDetails,
      });
    } else {
      return res.json({
        statusCode: 200,
        userDetails: [],
      });
    }
  } catch (error) {
    console.log("userDetails error", error);

    return res.json({
      statusCode: 500,
      error,
    });
  }
};

/* Get userDetails for chat list */
const chatUserDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    console.log("chat body", id);
    if (id?.length === 0) {
      return res.json({
        statusCode: 400,
        error: "User IDs required",
      });
    }

    /* Join users and user_settings tables */
    const [userDetails] = await DB.query(
      "select users.id, name, image, mobile, dob, enable_whatsapp, profile_chat, user_location.country from users left join user_settings on users.id = user_settings.user_id left join user_location on users.id = user_location.user_id where users.id in (?) and users.deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      /* Return ordered user details */
      const orderedUserDetails = id.map((userId) =>
        userDetails.find((user) => user.id === Number(userId))
      );

      // console.log("orderedUserDetails", orderedUserDetails);

      return res.json({
        statusCode: 200,
        userDetails: orderedUserDetails,
      });
    } else {
      return res.json({
        statusCode: 200,
        userDetails: [],
      });
    }
  } catch (error) {
    return res.json({
      statusCode: 500,
      error,
    });
  }
};

module.exports = {
  userDetails,
  chatUserDetails,
};
