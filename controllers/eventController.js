const DB = require("../config/DB");
const createError = require("http-errors");
const sendNotification = require("../utils/sendNotifications");
const generateSignedUrl = require("../utils/generateSignedUrl");
const countryFlag = require("../utils/countryFlag");

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
    const {
      page = 1,
      limit = 10,
      search = "",
      gender = "",
      subscription = "",
      country,
    } = req.query;
    const offset = (page - 1) * limit;
    let queryParams = [];
    let whereClauses = [];

    // Base SQL query with LEFT JOIN for subscription
    let sql = `
      SELECT users.*, subscription.plan_id ,subscription_plans.name as plan_name,user_location.country
      FROM users 
      LEFT JOIN user_location ON users.id = user_location.user_id
      LEFT JOIN subscription ON users.id = subscription.user_id  LEFT JOIN subscription_plans ON subscription_plans.id = subscription.plan_id
      WHERE users.deleted_at is null 
    `;

    // Prepare conditional WHERE clauses for search, subscription, and gender filtering
    if (search) {
      whereClauses.push(
        "(users.name LIKE ? OR users.user_name LIKE ? OR users.id LIKE ? OR user_location.country LIKE ?  OR users.mobile LIKE ?)"
      );
      queryParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    if (subscription) {
      whereClauses.push("subscription.plan_id = ?");
      queryParams.push(subscription);
    }

    if (gender) {
      whereClauses.push("users.gender = ?");
      queryParams.push(gender);
    }
    if (country && country !== "undefined") {
      whereClauses.push("user_location.country = ?");
      queryParams.push(country);
    }

    // Apply WHERE conditions if any
    if (whereClauses.length > 0) {
      sql += "and " + whereClauses.join(" AND ");
    }

    // Add ORDER BY and LIMIT clauses for pagination
    const paginatedSQL = `${sql} ORDER BY users.created_at DESC LIMIT ?, ?`;
    queryParams.push(offset, Number(limit));

    // Query for paginated data
    const [results] = await DB.query(paginatedSQL, queryParams);

    // Query for the total number of users (for totalPages calculation)
    const countSQL =
      `
      SELECT COUNT(*) as totalUsers 
      FROM users 
      LEFT JOIN subscription ON users.id = subscription.user_id
       LEFT JOIN user_location ON users.id = user_location.user_id
    WHERE users.deleted_at is null
    ` + (whereClauses.length > 0 ? "and" + whereClauses.join(" AND ") : "");

    const [countResult] = await DB.query(countSQL, queryParams.slice(0, -2)); // exclude LIMIT params

    // Calculate total pages
    const totalUsers = countResult[0].totalUsers;
    const totalPages = Math.ceil(totalUsers / limit);

    // Check if results exist and respond accordingly
    if (results?.length) {
      return res.status(200).json({
        message: "Users found",
        data: results,
        totalPages: totalPages,
        currentPage: page,
        totalUsers: totalUsers,
      });
    } else {
      return res.status(200).json({
        message: "Users not found",
        data: [],
        totalPages: 0,
        currentPage: page,
        totalUsers: 0,
      });
    }
  } catch (error) {
    console.log(error);
    return next(createError(500, error));
  }
};

const getAllSubscriptions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      gender = "",
      subscription = "",
      country,
    } = req.query;
    const offset = (page - 1) * limit;
    let queryParams = [];
    let whereClauses = [];

    // Base SQL query with LEFT JOIN for subscription
    let sql = `
      SELECT users.*, subscription.plan_id ,subscription_plans.name as plan_name,user_location.country
      FROM users 
      LEFT JOIN user_location ON users.id = user_location.user_id
      LEFT JOIN subscription ON users.id = subscription.user_id  LEFT JOIN subscription_plans ON subscription_plans.id = subscription.plan_id
      WHERE users.deleted_at is null 
    `;

    // Prepare conditional WHERE clauses for search, subscription, and gender filtering
    if (search) {
      whereClauses.push(
        "(users.name LIKE ? OR users.user_name LIKE ? OR users.id LIKE ? OR user_location.country LIKE ?  OR users.mobile LIKE ?)"
      );
      queryParams.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    if (subscription) {
      whereClauses.push("subscription.plan_id = ?");
      queryParams.push(subscription);
    }

    if (gender) {
      whereClauses.push("users.gender = ?");
      queryParams.push(gender);
    }
    if (country && country !== "undefined") {
      whereClauses.push("user_location.country = ?");
      queryParams.push(country);
    }

    // Apply WHERE conditions if any
    if (whereClauses.length > 0) {
      sql += "and " + whereClauses.join(" AND ");
    }

    // Add ORDER BY and LIMIT clauses for pagination
    const paginatedSQL = `${sql} ORDER BY users.created_at DESC LIMIT ?, ?`;
    queryParams.push(offset, Number(limit));

    // Query for paginated data
    const [results] = await DB.query(paginatedSQL, queryParams);

    // Query for the total number of users (for totalPages calculation)
    const countSQL =
      `
      SELECT COUNT(*) as totalUsers 
      FROM users 
      LEFT JOIN subscription ON users.id = subscription.user_id
       LEFT JOIN user_location ON users.id = user_location.user_id
    WHERE users.deleted_at is null
    ` + (whereClauses.length > 0 ? "and" + whereClauses.join(" AND ") : "");

    const [countResult] = await DB.query(countSQL, queryParams.slice(0, -2)); // exclude LIMIT params

    // Calculate total pages
    const totalUsers = countResult[0].totalUsers;
    const totalPages = Math.ceil(totalUsers / limit);

    // Check if results exist and respond accordingly
    if (results?.length) {
      return res.status(200).json({
        message: "Users found",
        data: results,
        totalPages: totalPages,
        currentPage: page,
        totalUsers: totalUsers,
      });
    } else {
      return res.status(200).json({
        message: "Users not found",
        data: [],
        totalPages: 0,
        currentPage: page,
        totalUsers: 0,
      });
    }
  } catch (error) {
    console.log(error);
    return next(createError(500, error));
  }
};

const changeSubscriptions = async (req, res, next) => {
  try {
    const { user_id, subscription } = req.body;

    // Base SQL query with LEFT JOIN for subscription
    let sql = `
      update subscription set plan_id=? where user_id =? and deleted_at is null;
    `;

    // Query for paginated data
    const [results] = await DB.query(sql, [user_id, Number(subscription)]);

    if (results?.affectedRows) {
      return res.status(200).json({
        message: "Subscription plan updated",
      });
    } else {
      return res.status(400).json({
        message: "Subscription plan update failed",
      });
    }
  } catch (error) {
    console.log(error);
    return next(createError(500, error));
  }
};

const getAllAppUsersById = async (req, res, next) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return next(createError(400, "User_id is required"));
    }
    let queryParams = [Number(user_id)];

    // Base SQL query with LEFT JOIN for subscription
    let sql = `
      SELECT users.*, subscription.plan_id ,subscription_plans.name as plan_name,user_location.country,user_location.cca3
      FROM users 
      LEFT JOIN user_location ON users.id = user_location.user_id
      LEFT JOIN subscription ON users.id = subscription.user_id  LEFT JOIN subscription_plans ON subscription_plans.id = subscription.plan_id
      WHERE users.deleted_at is null and users.id=?
    `;

    // Query for  data
    const [results] = await DB.query(sql, queryParams);

    // Check if results exist and respond accordingly
    if (results?.length) {
      const user_details = results?.[0];
      if (user_details && user_details?.image) {
        user_details.image = user_details?.image
          ? await generateSignedUrl(user_details?.image)
          : null;
      }
      if (user_details && user_details?.cca3) {
        const flag = countryFlag.find(
          (list) => list.iso3 === user_details?.cca3
        );
        user_details.flag = flag?.emoji;
      }
      if (user_details && user_details?.interests) {
        const interestsArray = JSON.parse(user_details?.interests); // Parse the JSON string if needed
        const placeholders = interestsArray.map(() => "?").join(","); // Creates a list of placeholders for each element in the array
        const [interests] = await DB.query(
          `SELECT id, name FROM interests WHERE id IN (${placeholders})`,
          interestsArray
        );
        user_details.interests = interests;
      }

      return res.status(200).send({
        message: "Users found",
        data: user_details,
      });
    } else {
      return res.status(200).json({
        message: "Users not found",
        data: null,
      });
    }
  } catch (error) {
    console.log(error);
    return next(createError(500, error));
  }
};

const getDashboardData = async (req, res, next) => {
  try {
    //dashlet   counts
    let sql = `SELECT
    (SELECT COUNT(*)
     FROM users
     WHERE deleted_at IS NULL) AS active_users_count,
    (SELECT COUNT(DISTINCT ul.country)
     FROM user_location ul
     JOIN users u ON ul.user_id = u.id
     WHERE u.deleted_at IS NULL) AS distinct_countries_count,
    (SELECT COUNT(*)
     FROM users
     WHERE deleted_at IS NOT NULL) AS inactive_users_count;`;
    // country count
    let sql2 = `SELECT  ul.country,ul.cca3,COUNT( ul.country) as count
     FROM user_location ul
     JOIN users u ON ul.user_id = u.id
     WHERE u.deleted_at IS NULL  GROUP by ul.country`;

    // Query for paginated data
    const [results] = await DB.query(`${sql}${sql2}`);

    const dashletCounts = results?.[0]?.[0] || null;
    const countriesCount = results?.[1] || [];
    // Check if results exist and respond accordingly
    if (results?.length) {
      for (const country of countriesCount) {
        if (country) {
          const flag = countryFlag.find((list) => list.iso3 === country?.cca3);
          country.flag = flag?.emoji || null;
          // user_data.push(user);
        }
      }
      return res.status(200).json({
        message: "success",
        dashletCounts,
        countriesCount,
      });
    } else {
      return res.status(200).json({
        message: "success",
        dashletCounts: [],
        countriesCount: [],
      });
    }
  } catch (error) {
    console.log(error);
    return next(createError(500, error));
  }
};

const getCountryUsers = async (req, res, next) => {
  try {
    const { country, page = 1, limit = 10, search } = req.query;
    if (!country) {
      return next(createError(500, "Country is required"));
    }
    // Calculate the offset for pagination
    const offset = (page - 1) * limit;

    // Prepare the search filter
    const searchFilter = search ? `%${search}%` : "%";

    // Query to get filtered users with pagination
    const [userDetails] = await DB.query(
      `SELECT users.id, name, user_name, dob, image, user_location.country,user_location.cca3, subscription.plan_id
      FROM users
      LEFT JOIN user_location ON users.id = user_location.user_id
      LEFT JOIN subscription ON users.id = subscription.user_id
      WHERE user_location.country LIKE ? 
        AND (users.name LIKE ? OR users.user_name LIKE ?)
        AND users.deleted_at IS NULL
      LIMIT ? OFFSET ?`,
      [`%${country}%`, searchFilter, searchFilter, +limit, +offset]
    );

    // Query to get the total count of filtered users
    const [[totalCount]] = await DB.query(
      `SELECT COUNT(*) as total 
      FROM users
      LEFT JOIN user_location ON users.id = user_location.user_id
      WHERE user_location.country LIKE ? 
        AND (users.name LIKE ? OR users.user_name LIKE ?)
        AND users.deleted_at IS NULL`,
      [`%${country}%`, searchFilter, searchFilter]
    );

    const totalPages = Math.ceil(totalCount.total / limit);

    if (userDetails?.length) {
      let user_data = [];

      for (const user of userDetails) {
        if (user) {
          user.image = user?.image
            ? await generateSignedUrl(user?.image)
            : null;
          const flag = countryFlag.find((list) => list.iso3 === user.cca3);
          user.flag = flag?.emoji || null;
          user_data.push(user);
        }
      }

      return res.json({
        statusCode: 200,
        userDetails: user_data,
        totalPages: totalPages,
        currentPage: +page,
      });
    } else {
      return res.json({
        statusCode: 200,
        userDetails: [],
        totalPages: 0,
        currentPage: +page,
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
  getblockedUserDetails,
  sendChatPushNotification,
  getBlockedUserIds,
  getAllAppUsers,
  getDashboardData,
  getCountryUsers,
  getAllAppUsersById,
  getAllSubscriptions,
  changeSubscriptions,
};
