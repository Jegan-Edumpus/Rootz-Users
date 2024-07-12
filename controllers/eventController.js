const DB = require("../config/DB");
const createError = require("http-errors");
const sendNotification = require("../utils/sendNotifications");

/* Get userdetails by ID */
const userDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    if (id?.length === 0) {
      return res.json({
        statusCode: 400,
        error: "User IDs required",
      });
    }

    console.log("id", id);
    const [userDetails] = await DB.query(
      "select users.id, name, dob, image, user_location.country from users left join user_location on users.id = user_location.user_id where users.id in (?) and users.deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      /* Return ordered user details */
      const orderedUserDetails = id.map((userId) =>
        userDetails.find((user) => user.id === Number(userId))
      );
      console.log("orderedUserDetails", orderedUserDetails);
      return res.json({
        statusCode: 200,
        userDetails: orderedUserDetails,
      });
    } else {
      return res.json({
        statusCode: 200,
        userDetails: [],
      });
    }
  } catch (error) {
    console.log("userDetails error", error);

    return res.json({
      statusCode: 500,
      error,
    });
  }
};

/* Get userDetails for chat list */
const chatUserDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    console.log("chat body", id);
    if (id?.length === 0) {
      return res.json({
        statusCode: 400,
        error: "User IDs required",
      });
    }

    /* Join users and user_settings tables */
    const [userDetails] = await DB.query(
      "select users.id, name, image, mobile, dob, enable_whatsapp, profile_chat, user_location.country from users left join user_settings on users.id = user_settings.user_id left join user_location on users.id = user_location.user_id where users.id in (?) and users.deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      /* Return ordered user details */
      const orderedUserDetails = id.map((userId) =>
        userDetails.find((user) => user.id === Number(userId))
      );

      // console.log("orderedUserDetails", orderedUserDetails);

      return res.json({
        statusCode: 200,
        userDetails: orderedUserDetails,
      });
    } else {
      return res.json({
        statusCode: 200,
        userDetails: [],
      });
    }
  } catch (error) {
    return res.json({
      statusCode: 500,
      error,
    });
  }
};

function getMessageBody({ username, message_type }) {
  switch (message_type) {
    case "connection_request":
      return `${username} sent you a connection request`;
    case "reject":
      return `${username} reject your connection request`;
    case "accept":
      return `${username} accepted your connection request`;
    case "likes":
      return `${username} liked your post`;
    case "comments":
      return `${username} commented on your post`;
    case "comments_reply":
      return `${username} replied for your comment`;
    default:
      return null;
  }
}

const sendPushNotification = async (req, res, next) => {
  try {
    const {
      user_id,
      request_id,
      message_type = "connection_request",
      notification_type = "connection_request",
      post_id = null,
    } = req.body;

    console.log("sending push notifications", {
      user_id,
      request_id,
      message_type,
      notification_type,
      post_id,
    });

    const [userData] = await DB.query(
      "select device_arns, device_tokens,users.name from user_notification left join users on user_notification.user_id = users.id where user_notification.user_id=? and users.deleted_at is null;select name from users where id=?",
      [request_id, user_id]
    );

    console.log("data-------------", userData[0][0], userData[1][0]);
    if (userData) {
      /* Get device arns from likedUser */
      const deviceArns = userData?.[0][0]?.device_arns;

      /* Get device tokens from likedUser */
      const deviceTokens = userData?.[0][0]?.device_tokens;

      const message = await getMessageBody({
        username: userData?.[1]?.[0]?.name,
        message_type,
      });

      console.log({ message });

      const messageContent = {
        notification: {
          title: "Rootz",
          body: message,
        },
        data: {
          type: notification_type,
          post_id,
        },
      };
      /* Get end user device details */

      /* Parse liked user device tokens array */
      const UserDeviceArnsArray =
        deviceArns && deviceArns !== "NULL" ? JSON.parse(deviceArns) : [];
      console.log({ UserDeviceArnsArray });
      await sendNotification({
        deviceArns: UserDeviceArnsArray,
        messageContent,
      });
      return res.json({
        statusCode: 200,
        message: "successfully sent notification",
      });
    } else {
      return res.json({
        statusCode: 200,
        message: "no user data found",
      });
    }
  } catch (error) {
    console.log("userDetails error", error);

    return res.json({
      statusCode: 500,
      error,
    });
  }
};

module.exports = {
  userDetails,
  chatUserDetails,
  sendPushNotification,
};
