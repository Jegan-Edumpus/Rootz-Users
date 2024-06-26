const DB = require("../config/DB");
const createError = require("http-errors");

/* Get all interests */
const getAllInterests = async (req, res, next) => {
  try {
    const [interests] = await DB.query(
      "select id, name from interests where deleted_at is null"
    );
    if (interests.length) {
      return res.status(200).json({
        interests: interests,
      });
    } else {
      return next(createError(404, "No interests found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

module.exports = { getAllInterests };
