const createError = require("http-errors");

const versionHandler = (version) => {
  return (req, res, next) => {
    /* Remove v from request version and convert into number */
    const requestVersion = parseInt(req.params.version.substring(1));

    if (!requestVersion || typeof requestVersion !== "number") {
      return next(createError(400, "Invalid API version requested"));
    } else if (requestVersion >= version) {
      return next();
    }

    return next("route");
  };
};

module.exports = versionHandler;
