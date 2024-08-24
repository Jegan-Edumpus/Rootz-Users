const DB = require("../config/DB");
const createError = require("http-errors");
const sendNotification = require("../utils/sendNotifications");
const generateSignedUrl = require("../utils/generateSignedUrl");

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
      "select users.id, name, dob, image, user_location.country ,subscription.plan_id from users left join user_location on users.id = user_location.user_id left join subscription on users.id = subscription.user_id where users.id in (?) and users.deleted_at is null",
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

const getblockedUserDetails = async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.json({
        statusCode: 400,
        error: "User ID required",
      });
    }

    console.log("id", id);
    const [getBlockedUsers] = await DB.query(
      `SELECT blocked_to FROM user_block where user_id=? and deleted_at is null UNION SELECT reported_to FROM reports where user_id=? and deleted_at is null`,
      [id, id]
    );

    const blockedUsersId = getBlockedUsers?.map((user) => user.blocked_to);

    console.log("blockedUsersId", blockedUsersId);

    if (getBlockedUsers?.length) {
      const blockedUsersId = getBlockedUsers?.map((user) => user.blocked_to);

      console.log("blockedUsersId", blockedUsersId);

      return res.json({
        statusCode: 200,
        blockedUsersId: blockedUsersId,
      });
    } else {
      return res.json({
        statusCode: 200,
        blockedUsersId: [],
      });
    }
  } catch (error) {
    console.log("blockedUsersId error", error);

    return res.json({
      statusCode: 500,
      error,
    });
  }
};

/* Get blocked user_ids only (not reported user_ids) */
const getBlockedUserIds = async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.json({
        statusCode: 400,
        error: "User ID required",
      });
    }

    console.log("id", id);
    const [getBlockedUsers] = await DB.query(
      `SELECT blocked_to FROM user_block where user_id=? and deleted_at is null`,
      [id]
    );

    if (getBlockedUsers?.length) {
      const blockedUsersId = getBlockedUsers?.map((user) => user.blocked_to);

      console.log("blockedUsersId", blockedUsersId);

      return res.json({
        statusCode: 200,
        blockedUsersId: blockedUsersId,
      });
    } else {
      return res.json({
        statusCode: 200,
        blockedUsersId: [],
      });
    }
  } catch (error) {
    console.log("blockedUsersId error", error);

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
      "select users.id, name, image, mobile, dob, enable_whatsapp, profile_chat, user_location.country, plan_id from users left join user_settings on users.id = user_settings.user_id left join subscription on users.id = subscription.user_id left join user_location on users.id = user_location.user_id where users.id in (?) and users.deleted_at is null",
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
    case "comment_likes":
      return `${username} liked your comment`;
    case "chats":
      return `${username} sent you a new message`;
    case "mention":
      return `${username} mentioned you in a post`;
    case "mention_comment":
      return `${username} mentioned you in a comment`;
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
      post_owner_id = null,
    } = req.body;

    console.log("sending push notifications", {
      user_id,
      request_id,
      message_type,
      notification_type,
      post_id,
    });

    const [userData] = await DB.query(
      "select device_arns, device_tokens,users.name from user_notification left join users on user_notification.user_id = users.id where user_notification.user_id=? and users.deleted_at is null;select users.id, name, image, mobile, dob, enable_whatsapp, profile_chat, user_location.country from users left join user_settings on users.id = user_settings.user_id left join user_location on users.id = user_location.user_id where users.id=? and users.deleted_at is null",
      [request_id, user_id]
    );

    console.log("data-------------", userData[0][0], userData[1][0]);
    if (userData) {
      /* Get device arns from likedUser */
      const deviceArns = userData?.[0][0]?.device_arns;

      /* Get device tokens from likedUser */
      const deviceTokens = userData?.[0][0]?.device_tokens;
      const user_details = userData?.[1]?.[0];
      const message = await getMessageBody({
        username: user_details?.name,
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
          user_id,
          request_id,
          user_details,
          post_owner_id,
        },
      };

      console.log({ messageContent });
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

const sendChatPushNotification = async (req, res, next) => {
  try {
    const {
      user_id,
      request_id,
      match_id = null,
      chat_status = null,
      message_type = "chats",
      notification_type = "chats",
      post_id = null,
    } = req.body;

    console.log("sending chat push notifications", {
      user_id,
      request_id,
      message_type,
      notification_type,
      post_id,
      match_id,
      chat_status,
    });

    const [userData] = await DB.query(
      "select device_arns, device_tokens,users.name from user_notification left join users on user_notification.user_id = users.id where user_notification.user_id=? and users.deleted_at is null;select users.id, name, image, mobile, dob, enable_whatsapp, profile_chat, user_location.country from users left join user_settings on users.id = user_settings.user_id left join user_location on users.id = user_location.user_id where users.id=? and users.deleted_at is null",
      [request_id, user_id]
    );

    console.log("data-------------", userData[0][0], userData[1][0]);
    if (userData) {
      /* Get device arns from likedUser */
      const deviceArns = userData?.[0][0]?.device_arns;

      /* Get device tokens from likedUser */
      const deviceTokens = userData?.[0][0]?.device_tokens;

      const user_details = userData?.[1]?.[0];
      if (user_details && user_details?.image) {
        user_details.image = user_details?.image
          ? await generateSignedUrl(user_details?.image)
          : null;
      }

      const message = await getMessageBody({
        username: user_details?.name,
        message_type,
      });

      const messageContent = {
        notification: {
          title: "Rootz",
          body: message,
        },
        data: {
          type: notification_type,
          post_id,
          match_id,
          chat_status,
          user_id,
          request_id,
          ...user_details,
        },
      };

      console.log({ user_details });
      console.log({ message, messageContent });
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

const getAllAppUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = "", filter = {} } = req.query;
    const offset = (page - 1) * limit;

    // Base SQL query with LEFT JOIN for subscription
    let sql = `
      SELECT users.*, subscription.plan_id FROM users LEFT JOIN subscription ON users.id = subscription.user_id
    `;
    let queryParams = [];

    // Array for conditional WHERE clauses
    let whereClauses = [];

    // If search is provided, add WHERE clause for name or username
    if (search) {
      whereClauses.push("(users.name LIKE ? OR users.username LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // If filter.subscription exists, apply specific plan_id filter
    if (filter.subscription) {
      whereClauses.push("subscription.plan_id = ?");
      queryParams.push(filter.subscription);
    }

    // If filter.gender exists, apply gender filter (male, female, others)
    if (filter.gender) {
      whereClauses.push("users.gender = ?");
      queryParams.push(filter.gender);
    }

    // If there are any WHERE conditions, add them to the SQL query
    if (whereClauses.length > 0) {
      sql += " WHERE " + whereClauses.join(" AND ");
    }

    // Add ORDER BY and LIMIT clauses for pagination
    sql += " ORDER BY users.created_at DESC LIMIT ?, ?";
    queryParams.push(offset, Number(limit));
    console.log({ sql, queryParams });
    // Execute the query
    const [results] = await DB.query(sql, queryParams);

    // Check if results exist and respond accordingly
    if (results?.length) {
      return res.status(200).json({
        message: "Users found",
        data: results,
      });
    } else {
      return res.status(200).json({
        message: "Users not found",
        data: [],
      });
    }
  } catch (error) {
    console.log(error);
    return next(createError(500, error));
  }
};

module.exports = {
  userDetails,
  chatUserDetails,
  sendPushNotification,
  getblockedUserDetails,
  sendChatPushNotification,
  getBlockedUserIds,
  getAllAppUsers,
};
