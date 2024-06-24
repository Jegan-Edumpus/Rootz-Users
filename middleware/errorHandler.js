/* Error handler middleware */
const errorHandler = (err, req, res, next) => {
  return res.status(err.status || 500).json({
    error: { ...err, message: err.message || "Internal Server Error" },
  });
};

module.exports = errorHandler;
