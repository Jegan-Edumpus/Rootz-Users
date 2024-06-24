const {
  getSignedUrl: getcloudFrontUrl,
} = require("@aws-sdk/cloudfront-signer");
const generateSignedUrl = async (filename) => {
  try {
    const imageRequest = JSON.stringify({
      bucket: process.env.BUCKET,
      key: filename,
      edits: {
        resize: {},
      },
    });
    const buffer = Buffer.from(imageRequest).toString("base64");
    const s3ObjectKey = buffer;
    const url = `${process.env.CLOUDFRONT_URL}/${s3ObjectKey}`;
    const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY;
    const keyPairId = process.env.CLOUDFRONT_KEYPAIR_ID;
    const dateLessThan = new Date();
    dateLessThan.setHours(dateLessThan.getHours() + 8);
    const signedUrl = await getcloudFrontUrl({
      url,
      keyPairId,
      dateLessThan,
      privateKey,
    });
    return signedUrl;
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};

module.exports = generateSignedUrl;
