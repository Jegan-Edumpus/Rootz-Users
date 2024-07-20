const DB = require("../config/DB");
const createError = require("http-errors");
const generateSignedUrl = require("../utils/generateSignedUrl");
const countryFlag = require("../utils/countryFlag");
const mysql = require("mysql2");
const axios = require("axios");
const { sendConnectionMessage } = require("../utils/sqsHandler");

/* Get premium users */
const premiumUsers = async (req, res, next) => {
  try {
    const {
      id = "",
      gender = "",
      distance = "100",
      min_age = "18",
      max_age = "36",
      show_in_range = "",
      city = "",
      page = 1,
      limit = 20,
    } = req.query;
    const offset = (page - 1) * limit;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    /* Check user & location details is exist */
    const [userDetails] = await DB.query(
      "select latitude, longitude from user_location where user_id=? and deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      const { latitude, longitude } = userDetails[0];
      /* Get reported and blocked users */
      const [getBlockedUsers] = await DB.query(
        `SELECT blocked_to FROM user_block where user_id=? and deleted_at is null UNION SELECT reported_to FROM reports where user_id=? and deleted_at is null`,
        [id, id]
      );

      const blockedUsersId = getBlockedUsers?.map((user) => user.blocked_to);

      console.log("blockedUsersId", blockedUsersId);

      let initialQuery =
        "SELECT users.id, cca3, name, image, dob, gender, (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(user_location.latitude)) * COS(RADIANS(user_location.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(user_location.latitude)))) AS distance FROM users left join subscription on users.id = subscription.user_id left join user_location on users.id = user_location.user_id WHERE users.id != ? and subscription.plan_id != ? and users.deleted_at is null and DATE_FORMAT(NOW(), '%Y') - DATE_FORMAT(dob, '%Y') BETWEEN ? AND ? and not users.id in (?)";

      let placeholder = [
        latitude || "",
        longitude || "",
        latitude || "",
        id,
        0,
        Number(min_age),
        Number(max_age),
        blockedUsersId?.length ? blockedUsersId : "",
      ];

      if (gender === "male" || gender === "female") {
        initialQuery += " and gender = ?";
        placeholder.push(gender);
      }

      if (city) {
        initialQuery += " and city = ?";
        placeholder.push(city);
      }

      const [getUsers] = await DB.query(
        `${initialQuery} having distance <= ? order by distance asc limit ?, ?`,
        [
          ...placeholder,
          show_in_range ? distance : 30000,
          offset,
          Number(limit),
        ]
      );

      if (getUsers?.length) {
        const getPeopleCount = mysql.format(
          `${initialQuery} having distance <= ?`,
          [...placeholder, show_in_range ? distance : 30000]
        );

        const [[usersCount]] = await DB.query(
          `SELECT COUNT(id) AS count FROM (${getPeopleCount}) AS subquery`
        );

        const totalPages = Math.ceil(usersCount?.count / limit);
        const currentPage = parseInt(page);

        for (const item of getUsers) {
          const signedUrl = await generateSignedUrl(item.image);
          item.image = signedUrl;
          const flag = countryFlag.find((list) => list.iso3 === item.cca3);
          item.flag = flag?.emoji || null;
        }

        return res.status(200).json({
          users: getUsers,
          totalPages: totalPages,
          currentPage: currentPage,
        });
      } else {
        return res.status(200).json({
          message: "Users not found",
          users: [],
        });
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Get discover users */
const discoverUsers = async (req, res, next) => {
  try {
    const {
      id = "",
      gender = "",
      distance = "100",
      min_age = "18",
      max_age = "36",
      show_in_range = "",
      city = "",
      page = 1,
      limit = 15,
    } = req.query;

    const offset = (page - 1) * limit;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    /* Check user & location details is exist */
    const [userDetails] = await DB.query(
      "select latitude, longitude, interests from users left join user_location on users.id = user_location.user_id where users.id=? and users.deleted_at is null",
      [id]
    );

    console.log("userDetails", userDetails);

    if (userDetails?.length) {
      const { latitude, longitude, interests } = userDetails[0];

      /* Parse current users interest */
      const userInterests =
        interests && interests !== "NULL" ? JSON.parse(interests) : [];

      /* Get reported and blocked users */
      const [getBlockedUsers] = await DB.query(
        `SELECT blocked_to FROM user_block where user_id=? and deleted_at is null UNION SELECT reported_to FROM reports where user_id=? and deleted_at is null`,
        [id, id]
      );
      const blockedUsersId = getBlockedUsers?.map((user) => user.blocked_to);

      /* Get connected and pending request user_ids from connection microservice*/
      const connectionIds = await axios.get(
        `${process.env.CONNECTIONS_BASEURL}/connected-users?id=${id}`,
        {
          headers: {
            Authorization: "Bearer " + req.token,
            "Content-Type": "application/json",
          },
        }
      );

      if (connectionIds.data.statusCode === 200) {
        const connectedUserIds = connectionIds.data.connected_ids;
        const pendingUserIds = connectionIds.data.pending_ids;

        console.log("pendingUserIds", pendingUserIds);

        /* Combine blocked, reported and connected user_ids */
        const ignoreIds = [...blockedUsersId, ...connectedUserIds];

        // console.log("ignoreIds", ignoreIds);

        // // const interestPlaceholders = userInterests
        // //   .map(() => "JSON_CONTAINS(users.interests, ?)")
        // //   .join(" + ");

        const interestPlaceholders = userInterests.length
          ? userInterests
              .map(() => "JSON_CONTAINS(users.interests, ?)")
              .join(" + ")
          : "";

        let initialQuery = `SELECT users.id, name, image, interests, user_location.cca3, dob, plan_id, (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(user_location.latitude)) * COS(RADIANS(user_location.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(user_location.latitude)))) AS distance, ${
          userInterests?.length
            ? `(${interestPlaceholders}) AS matching_interests`
            : "0 AS matching_interests"
        } FROM users left join user_location on users.id = user_location.user_id left join subscription on users.id = subscription.user_id where users.deleted_at is null AND DATE_FORMAT(NOW(), '%Y') - DATE_FORMAT(dob, '%Y') BETWEEN ? AND ? and users.id != ? and not users.id in (?)`;

        let placeholder = [
          latitude || "",
          longitude || "",
          latitude || "",
          ...(userInterests.length > 0
            ? userInterests.map((interest) => JSON.stringify([interest]))
            : []),
          Number(min_age),
          Number(max_age),
          id,
          ignoreIds?.length ? ignoreIds : "",
        ];

        if (gender === "male" || gender === "female") {
          initialQuery += " and gender = ?";
          placeholder.push(gender);
        }

        if (city) {
          initialQuery += " and city = ?";
          placeholder.push(city);
        }

        const [data] = await DB.query(
          `${initialQuery} having distance <= ? order by matching_interests DESC, distance asc limit ?,?`,
          [
            ...placeholder,
            show_in_range ? distance : 30000,
            offset,
            Number(limit),
          ]
        );

        if (data?.length) {
          const getPeopleCount = mysql.format(
            `${initialQuery} having distance <= ?`,
            [...placeholder, show_in_range ? distance : 30000]
          );

          const [[peopleCount]] = await DB.query(
            `SELECT COUNT(id) AS count FROM (${getPeopleCount}) AS subquery`
          );

          const totalPages = Math.ceil(peopleCount?.count / limit);
          const currentPage = parseInt(page);

          for (const item of data) {
            const signedUrl = await generateSignedUrl(item.image);
            item.image = signedUrl;
            const flag = countryFlag.find((list) => list.iso3 === item.cca3);
            item.flag = flag?.emoji || null;
            item.isPending = pendingUserIds.filter(
              (list) => item.id === list.id && list.isRequested === true
            ).length
              ? true
              : false;
            item.isRequesting = pendingUserIds.filter(
              (list) => item.id === list.id && list.isRequested === false
            ).length
              ? true
              : false;
          }
          return res.status(200).json({
            peopleData: data,
            totalPages: totalPages,
            currentPage: currentPage,
          });
        } else {
          return res.status(200).json({
            message: "No people found",
            peopleData: [],
          });
        }
      } else if (connectionIds.data.statusCode === 400) {
        return next(createError(400, connectionIds.data.error));
      } else {
        return next(createError(500, connectionIds.data.error));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    // console.log("discover error", error);
    return next(createError(500, error));
  }
};

/* Get User details by id */
const userDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    if (!id) {
      return next(createError(400, "User ID required"));
    }

    const [userDetails] = await DB.query(
      "select users.id, name, image, mobile, dob, about, interests, connections, posts, city, country, cca3, enable_whatsapp, profile_chat, private, latitude, longitude, plan_id from users left join subscription on users.id = subscription.user_id left join user_location on users.id = user_location.user_id left join user_settings on users.id = user_settings.user_id where users.id = ? and users.deleted_at is null",
      [id]
    );

    console.log("userDetails", userDetails);

    if (userDetails?.length) {
      const { id, image, cca3 } = userDetails[0];
      /* Get connected and pending request user_ids from connection microservice*/
      const connectionIds = await axios.get(
        `${process.env.CONNECTIONS_BASEURL}/connected-users?id=${user_id}`,
        {
          headers: {
            Authorization: "Bearer " + req.token,
            "Content-Type": "application/json",
          },
        }
      );

      if (connectionIds.data.statusCode === 200) {
        const pendingUserIds = connectionIds.data.pending_ids;

        const signedUrl = await generateSignedUrl(image);
        const flag = countryFlag.find((list) => list.iso3 === cca3);

        /* Get matchedData based on current & other user ids */
        const matchedUsers = await axios.post(
          `${process.env.CONNECTIONS_BASEURL}/matched-users`,
          { user_id: parseInt(user_id), request_id: parseInt(id) },
          {
            headers: {
              Authorization: "Bearer " + req.token,
              "Content-Type": "application/json",
            },
          }
        );

        if (matchedUsers.data.statusCode === 200) {
          const userData = matchedUsers.data?.matchedData;

          console.log("userData", userData);

          return res.status(200).json({
            userDetails: {
              ...userDetails[0],
              image: signedUrl,
              flag: flag?.emoji,
              isPending: pendingUserIds.filter(
                (list) => list.id === id && list.isRequested === true
              ).length
                ? true
                : false,
              isRequesting: pendingUserIds.filter(
                (list) => list.id === id && list.isRequested === false
              ).length
                ? true
                : false,
              isMatched: userData ? true : false,
              match_id: userData ? userData.id : null,
              chat_status: userData ? userData.is_matched : null,
            },
          });
        } else if (matchedUsers.data.statusCode === 400) {
          return next(createError(400, matchedUsers.data.error));
        } else {
          return next(createError(500, matchedUsers.data.error));
        }

        // console.log("connectionIds", connectionIds.data);
      } else if (connectionIds.data.statusCode === 400) {
        return next(createError(400, connectionIds.data.error));
      } else {
        return next(createError(500, connectionIds.data.error));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Global Search users */
const searchUsers = async (req, res, next) => {
  try {
    const { id = "", search = "", page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    /* Check user & location details is exist */
    const [userDetails] = await DB.query(
      "select latitude, longitude from user_location where user_id=? and deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      const { latitude, longitude } = userDetails[0];

      /* Get reported and blocked users */
      const [getBlockedUsers] = await DB.query(
        `SELECT blocked_to FROM user_block where user_id=? and deleted_at is null UNION SELECT reported_to FROM reports where user_id=? and deleted_at is null`,
        [id, id]
      );

      const blockedUsersId = getBlockedUsers?.map((user) => user.blocked_to);

      let initialQuery =
        "SELECT DISTINCT users.id, users.name, cca3, image, city, country, dob, plan_id, (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitude)))) AS distance FROM users LEFT JOIN interests ON JSON_CONTAINS(users.interests, JSON_ARRAY(interests.id)) left join user_location on users.id = user_location.user_id left join subscription on users.id = subscription.user_id WHERE users.id != ? and (users.name LIKE ? or city LIKE ? or country LIKE ? OR interests.name LIKE ?) and users.deleted_at is null and not users.id in (?)";

      let placeholder = [
        latitude || "",
        longitude || "",
        latitude || "",
        id,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        `%${search}%`,
        blockedUsersId?.length ? blockedUsersId : "",
      ];

      const [getUsers] = await DB.query(
        `${initialQuery} order by distance asc limit ?, ?`,
        [...placeholder, offset, Number(limit)]
      );

      if (getUsers?.length) {
        // console.log("getUsers", getUsers);
        const getPeopleCount = mysql.format(`${initialQuery}`, [
          ...placeholder,
        ]);

        const [[usersCount]] = await DB.query(
          `SELECT COUNT(id) AS count FROM (${getPeopleCount}) AS subquery`
        );

        for (const item of getUsers) {
          const signedUrl = await generateSignedUrl(item.image);
          item.image = signedUrl;
          const flag = countryFlag.find((list) => list.iso3 === item.cca3);
          item.flag = flag?.emoji || null;
        }

        const totalPages = Math.ceil(usersCount?.count / limit);
        const currentPage = parseInt(page);

        return res.status(200).json({
          data: getUsers,
          totalPages: totalPages,
          currentPage: currentPage,
          nbHits: usersCount?.count,
        });
      } else {
        return res.status(200).json({
          message: "Search results not found",
          data: [],
          nbHits: 0,
        });
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Block user */
const blockUser = async (req, res, next) => {
  try {
    const { user_id, request_id } = req.body;

    if (!user_id || !request_id) {
      return next(createError(400, "user_id and request_id are required"));
    }

    /* check if block already exist */
    const [userDetails] = await DB.query(
      "select id from user_block where user_id=? and blocked_to=? and deleted_at is null",
      [user_id, request_id]
    );

    if (userDetails?.length) {
      return next(createError(400, "User already blocked"));
    } else {
      const [addBlock] = await DB.query(
        "insert into user_block (user_id, blocked_to) values (?, ?)",
        [user_id, request_id]
      );

      if (addBlock.affectedRows) {
        /* Get matchedData based on current & other user ids */
        const matchedUsers = await axios.post(
          `${process.env.CONNECTIONS_BASEURL}/matched-users`,
          { user_id, request_id },
          {
            headers: {
              Authorization: "Bearer " + req.token,
              "Content-Type": "application/json",
            },
          }
        );

        if (matchedUsers.data.statusCode === 200) {
          const userData = matchedUsers.data?.matchedData;
          if (userData) {
            await DB.query(
              "update users set connections = GREATEST(connections - 1, 0) where id in (?) and deleted_at is null",
              [[user_id, request_id]]
            );
          }

          await sendConnectionMessage({
            user_id,
            request_id,
            action: "REMOVE_CONNECTION",
            to: "CONNECTION",
          });

          return res.status(200).json({
            message: "User Blocked successfully",
          });
        } else if (matchedUsers.data.statusCode === 400) {
          return next(createError(400, matchedUsers.data.error));
        } else {
          return next(createError(500, matchedUsers.data.error));
        }
      } else {
        return next(createError(400, "Unable to block user"));
      }
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Unblock user */
const unblockUser = async (req, res, next) => {
  try {
    const { user_id, request_id } = req.body;

    if (!user_id || !request_id) {
      return next(createError(400, "user_id and request_id are required"));
    }

    /* check if block already exist */
    const [checkBlock] = await DB.query(
      "select id from user_block where user_id=? and blocked_to=? and deleted_at is null",
      [user_id, request_id]
    );

    if (checkBlock?.length) {
      /* Remove block from table */
      const [removeBlock] = await DB.query(
        "update user_block set deleted_at=now() where user_id=? and blocked_to=? and deleted_at is null",
        [user_id, request_id]
      );

      if (removeBlock.affectedRows) {
        return res.status(200).json({
          message: "User unblocked successfully",
        });
      } else {
        return next(createError(400, "Unable to unblock user"));
      }
    } else {
      return next(createError(400, "No blocked ID found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Report user */
const reportUser = async (req, res, next) => {
  try {
    const { user_id, request_id, reason, comment } = req.body;

    if (!user_id || !request_id) {
      return next(createError(400, "user_id and request_id are required"));
    }

    /* Store report in reports table */
    const [createReport] = await DB.query(
      "insert into reports (user_id, reported_to, reason, comments) values (?, ?, ?, ?)",
      [user_id, request_id, reason, comment]
    );

    if (createReport?.affectedRows) {
      /* Get matchedData based on current & other user ids */
      const matchedUsers = await axios.post(
        `${process.env.CONNECTIONS_BASEURL}/matched-users`,
        { user_id, request_id },
        {
          headers: {
            Authorization: "Bearer " + req.token,
            "Content-Type": "application/json",
          },
        }
      );

      if (matchedUsers.data.statusCode === 200) {
        const userData = matchedUsers.data?.matchedData;
        if (userData) {
          await DB.query(
            "update users set connections = GREATEST(connections - 1, 0) where id in (?) and deleted_at is null",
            [[user_id, request_id]]
          );
        }
        await sendConnectionMessage({
          user_id,
          request_id,
          action: "REMOVE_CONNECTION",
          to: "CONNECTION",
        });
        return res.status(200).json({
          message: "User reported successfully",
        });
      } else if (matchedUsers.data.statusCode === 400) {
        return next(createError(400, matchedUsers.data.error));
      } else {
        return next(createError(500, matchedUsers.data.error));
      }
    } else {
      return next(createError(400, "Unable to report user"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

module.exports = {
  premiumUsers,
  discoverUsers,
  userDetails,
  searchUsers,
  blockUser,
  unblockUser,
  reportUser,
};
