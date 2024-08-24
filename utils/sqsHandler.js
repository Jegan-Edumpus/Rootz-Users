const { Producer } = require("sqs-producer");
const { sqs } = require("../config/aws");
const { nanoid } = require("nanoid");

/* configure new connection message producer */
const connectionProducer = Producer.create({
  queueUrl: process.env.CONNECTION_QUEUE_URL,
  region: process.env.REGION,
  sqs: sqs,
});

/* configure new notification message producer */
const notificationProducer = Producer.create({
  queueUrl: process.env.NOTIFICATION_QUEUE_URL,
  region: process.env.REGION,
  sqs: sqs,
});

/* condigure new post message producer */
const postProducer = Producer.create({
  queueUrl: process.env.POST_QUEUE_URL,
  region: process.env.REGION,
  sqs: sqs,
});

/* Connection message sender */
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

/* Notification message sender */
const sendNotificationMessage = async (data) => {
  const unique = nanoid();
  console.log("-----conenction message-----", unique);

  /* send message to connection service */
  await notificationProducer.send({
    id: unique,
    body: JSON.stringify(data),
    groupId: unique,
    deduplicationId: unique, // typically a hash of the message body
  });
};

/* Post message sender */
const sendPostMessage = async (data) => {
  const unique = nanoid();
  console.log("-----post message-----", unique);

  /* send message to connection service */
  await postProducer.send({
    id: unique,
    body: JSON.stringify(data),
    groupId: unique,
    deduplicationId: unique, // typically a hash of the message body
  });
};

module.exports = {
  sendConnectionMessage,
  sendPostMessage,
  sendNotificationMessage,
};
