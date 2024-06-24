const verifyFirebase = require("../utils/verifyFirebase");
const createError = require("http-errors");

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization;

  // Check if the authorization token is defined in the headers
  if (!header || !header.startsWith("Bearer ")) {
    return next(createError(400, "Authorization is required"));
  }

  const token = header.split(" ")[1]; // get the token

  try {
    // decode firebase token
    const decodedToken = await verifyFirebase(token);
    // setting uid and mobile number from firebase token in request
    req.user_id = decodedToken.uid;
    req.mobile = decodedToken.phone_number;
    next();
  } catch (error) {
    return next(createError(401, error));
  }
};

module.exports = verifyToken;
