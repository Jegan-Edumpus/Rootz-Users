const createError = require("http-errors");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3 } = require("../config/aws");

const uploadImage = async (req, res, next) => {
  if (!req.mobile) {
    return next(createError(400, "User ID required"));
  }
  const upload = multer({
    storage: multerS3({
      s3: s3,
      // acl: "public-read",
      bucket: process.env.BUCKET, // bucket name
      key: function (req, file, cb) {
        // modify file name with folder
        cb(
          null,
          `${process.env.BUCKETURL}/${req.mobile}-${Date.now() + 1}.${
            file?.mimetype.split("/")[1]
          }`
        );
      },
    }),
  }).single("image"); // uploads single file

  // upload handler
  upload(req, res, (error) => {
    // if error from multer package
    if (error instanceof multer.MulterError) {
      return next(createError(500, error));
    }

    // upload file error
    if (error) {
      return next(createError(500, error));
    }
    return next();
  });
};

module.exports = { uploadImage };
