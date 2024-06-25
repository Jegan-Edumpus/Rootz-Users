const DB = require("../config/DB");
const createError = require("http-errors");
const { registerSchema } = require("../validations/schema");
const generateUniqueId = require("../utils/generateUniqueId");

const registerUser = async (req, res, next) => {
  try {
    if (req?.file?.location) {
      return res.status(200).json({
        message: "success",
      });
    } else {
      return next(createError(400, "Unable to upload profile image"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

module.exports = {
  registerUser,
};
