const { s3 } = require("../config/aws");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

const deleteImage = async (filename) => {
  try {
    if (typeof filename !== "string" || filename.length === 0) {
      throw new Error("Invalid filename");
    }

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.BUCKET,
      Key: `${filename}`,
    });

    const fileResponse = await s3.send(deleteCommand);
    return fileResponse;
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = deleteImage;
