const { LocationClient } = require("@aws-sdk/client-location");
const { S3Client } = require("@aws-sdk/client-s3");
const { SNSClient } = require("@aws-sdk/client-sns");
const { SQSClient } = require("@aws-sdk/client-sqs");

const s3 = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
  },
});

const sns = new SNSClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
  },
});

const location = new LocationClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
  },
});

const sqs = new SQSClient({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
  },
});

module.exports = { s3, sns, location, sqs };
