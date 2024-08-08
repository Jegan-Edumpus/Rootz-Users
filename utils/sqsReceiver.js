const { Consumer } = require("sqs-consumer");
const DB = require("../config/DB");
const { sqs } = require("../config/aws");
const { getConnectionCount, getPostCount } = require("./helper");

/* handle receive connection queue messages */
const receiveHandler = async (data) => {
  try {
    /* Parse message body */
    const parsedBody = JSON.parse(data.Body);
    console.log("parsedBody---queue", data);
    const { action } = parsedBody;
    if (action === "CONNECTION_INCREMENT") {
      const { user_ids } = parsedBody;
      const count = await getConnectionCount({ user_id: user_ids });
      console.log({ count });
      /* increment connections count in users table based on user_ids array */
      if (count !== null) {
        await DB.query(
          "update users set connections = ? where id = ? and deleted_at is null; update users set connections = ? where id = ? and deleted_at is null",
          [count?.[0], user_ids?.[0], count?.[1], user_ids?.[1]]
        );
      }
    } else if (action === "CONNECTION_DECREMENT") {
      const { user_ids } = parsedBody;
      /* decrement connections count in users table based on user_ids array */
      const count = await getConnectionCount({ user_id: user_ids });
      console.log({ count });
      if (count !== null) {
        await DB.query(
          "update users set connections = ? where id = ? and deleted_at is null; update users set connections = ? where id = ? and deleted_at is null",
          [count?.[0], user_ids?.[0], count?.[1], user_ids?.[1]]
        );
      }
    } else if (action === "POST_INCREMENT") {
      const { user_id } = parsedBody;
      const count = await getPostCount({ user_id });
      console.log({ count });
      /* increment posts count in users table based on user_id */
      if (count !== null) {
        await DB.query(
          "update users set posts =? where id = ? and deleted_at is null",
          [count, user_id]
        );
      }
    } else if (action === "POST_DECREMENT") {
      const { user_id } = parsedBody;
      /* decrement posts count in users table based on user_id */
      const count = await getPostCount({ user_id });
      console.log({ count });
      /* increment posts count in users table based on user_id */
      if (count !== null) {
        await DB.query(
          "update users set posts =? where id = ? and deleted_at is null",
          [count, user_id]
        );
      }
    } else {
      console.log("invalid action", action);
    }
  } catch (error) {
    console.log("connection receiver error", error);
  }
};

// receive connection queue messages
const consumer = Consumer.create({
  queueUrl: process.env.USERS_QUEUE_URL,
  handleMessage: async (message) => {
    const { to } = JSON.parse(message.Body);
    console.log({ to });
    console.log("handling --queue", JSON.parse(message.Body));
    // handler queue messages using to field
    if (to === "USER") {
      await receiveHandler(message);
    } else {
      throw new Error(`Unable to process ${to}`);
    }
  },
  sqs: sqs,
});

// Add event listeners for error handling
consumer.on("error", (err) => {
  console.error("SQS consumer error:", err.message);
});

consumer.on("processing_error", (err) => {
  console.error("SQS processing error:", err.message);
});

consumer.on("timeout_error", (err) => {
  console.error("SQS timeout error:", err.message);
});

module.exports = consumer;
