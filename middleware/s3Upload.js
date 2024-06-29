const createError = require("http-errors");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3 } = require("../config/aws");
const sharp = require("sharp");
const DB = require("../config/DB");

const uploadImage = async (req, res, next) => {
  if (!req.user_id) {
    return next(createError(400, "User ID required"));
  }
  const upload = multer({
    storage: multerS3({
      s3: s3,
      // acl: "public-read",
      bucket: process.env.BUCKET, // bucket name
      contentType: function (req, file, callback) {
        const mimeType = file.mimetype; // Preserve original MIME type
        const outStream = sharp()
          .resize({ width: 500, height: 500, fit: sharp.fit.inside }) // Resize
          .webp({ quality: 90 }); // Convert to WebP

        file.stream.pipe(outStream);

        callback(null, mimeType, outStream);
      },
      key: async function (req, file, cb) {
        try {
          let alreadyUploaded = false;
          if (req.originalUrl.includes("/register")) {
            const { mobile, name } = req.body;

            /* Check if user already exist based on mobile number and deleted_at values */
            const [checkUser] = await DB.query(
              "select * from users where (mobile=? or name=?) and deleted_at is null",
              [mobile, name]
            );

            if (checkUser?.length) {
              alreadyUploaded = true;
            } else {
              alreadyUploaded = false;
            }
          }

          if (alreadyUploaded) {
            return next(createError(409, "User already exist"));
          }
          // modify file name with folder
          cb(
            null,
            `${process.env.BUCKETURL}/${req.user_id}-${Date.now() + 1}.webp`
          );
        } catch (error) {
          return next(createError(500, error));
        }
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
