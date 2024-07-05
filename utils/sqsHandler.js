const { Producer } = require("sqs-producer");
const { sqs } = require("../config/aws");
const { nanoid } = require("nanoid");

/* configure new connection message producer */
const connectionProducer = Producer.create({
  queueUrl: process.env.CONNECTION_QUEUE_URL,
  region: process.env.REGION,
  sqs: sqs,
});

const sendConnectionMessage = async (data) => {
  const unique = nanoid();
  console.log("-----conenction message-----", unique);

  /* send message to connection service */
  await connectionProducer.send({
    id: unique,
    body: JSON.stringify(data),
    groupId: unique,
    deduplicationId: unique, // typically a hash of the message body
  });
};

module.exports = {
  sendConnectionMessage,
};
