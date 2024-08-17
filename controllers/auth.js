const DB = require("../config/DB");
const createError = require("http-errors");
const { registerSchema } = require("../validations/schema");
const generateUniqueId = require("../utils/generateUniqueId");
const { generateUserName } = require("../utils/generateUserName");

/* Generate user_names based on name field */
const generateUserNames = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(200).json({
        userNames: [],
      });
    }
    const userNames = await generateUserName(name);
    return res.status(200).json({
      userNames,
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

const registerUser = async (req, res, next) => {
  try {
    const validatedBody = await registerSchema.validateAsync(req.body);
    const { name, mobile, country_code, dob, gender, user_name } =
      validatedBody;
    if (req?.file?.location) {
      /* Generate Profile ID*/
      const profileID = generateUniqueId();

      /* get uploaded image from s3 */
      const image = req?.file?.location
        ?.split("amazonaws.com/")[1]
        ?.replace(/%2F/g, "/");

      /* Insert into users table */
      const [rows] = await DB.query(
        "INSERT INTO users (name, mobile, country_code, dob, gender, user_id, profile_id, image, user_name ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          name,
          mobile,
          country_code,
          dob,
          gender,
          req.user_id,
          profileID,
          image,
          user_name,
        ]
      );
      if (rows.affectedRows) {
        //   /* Add looking for in user preference table */
        //   await DB.query(
        //     "insert into user_preference (preferred_gender, user_id) values (?, ?)",
        //     [looking_for, rows.insertId]
        //   );

        /* Add user_id in user_settings table */
        await DB.query("insert into user_settings (user_id) values (?)", [
          rows.insertId,
        ]);

        /* Add user_id in user_location table */
        await DB.query("insert into user_location (user_id) values (?)", [
          rows.insertId,
        ]);

        /* Add user_id in user_notification table */
        await DB.query("insert into user_notification (user_id) values (?)", [
          rows.insertId,
        ]);

        /* Add subscription */
        await DB.query("insert into subscription (user_id) values (?)", [
          rows.insertId,
        ]);

        return res.status(201).json({
          message: "User registered successfully",
          id: rows.insertId,
        });
      } else {
        return next(
          createError(500, "Unable to register user. Please try again")
        );
      }
    } else {
      return next(createError(400, "Unable to upload profile image"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Verify user existence */
const verifyUser = async (req, res, next) => {
  try {
    const [rows] = await DB.query(
      "select id from users where mobile=? and deleted_at is null",
      [req.mobile]
    );

    /* return boolean value based on user exist or not */
    return res.status(200).json({
      Message: "User verified successfully",
      isNewUser: rows.length > 0 ? false : true,
      id: rows.length > 0 ? rows[0].id : null,
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

module.exports = {
  registerUser,
  verifyUser,
  generateUserNames,
};
