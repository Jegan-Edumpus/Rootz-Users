const DB = require("../config/DB");
const createError = require("http-errors");

/* Get userdetails by ID */
const userDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id && id?.length === 0) {
      return next(createError(400, "User ID required"));
    }
    const [userDetails] = await DB.query(
      "select users.id, name, dob, image, user_location.country from users left join user_location on users.id = user_location.user_id where users.id in (?) and users.deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      return res.json({
        statusCode: 200,
        userDetails: userDetails,
      });
    } else {
      return res.json({
        statusCode: 404,
        error: `User not found`,
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

module.exports = {
  userDetails,
};
