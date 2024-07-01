const DB = require("../config/DB");
const createError = require("http-errors");
const generateSignedUrl = require("../utils/generateSignedUrl");
const countryFlag = require("../utils/countryFlag");
const mysql = require("mysql2");
const axios = require("axios");

/* Get premium users */
const premiumUsers = async (req, res, next) => {
  try {
    const {
      id = "",
      page = 1,
      limit = 20,
      type = "Premium",
      gender = "",
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
        "SELECT users.id, cca3, name, image, (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(user_location.latitude)) * COS(RADIANS(user_location.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(user_location.latitude)))) AS distance FROM users left join subscription on users.id = subscription.user_id left join user_location on users.id = user_location.user_id WHERE users.id != ? and subscription.plan_id = ? and users.deleted_at is null and not users.id in (?)";

      let placeholder = [
        latitude || "",
        longitude || "",
        latitude || "",
        id,
        type === "Premium" ? 3 : 2,
        blockedUsersId?.length ? blockedUsersId : "",
      ];

      if (gender === "male" || gender === "female") {
        initialQuery += " and gender = ?";
        placeholder.push(gender);
      }

      const [getUsers] = await DB.query(
        `${initialQuery} order by distance asc limit ?, ?`,
        [...placeholder, offset, Number(limit)]
      );

      if (getUsers?.length) {
        const getPeopleCount = mysql.format(`${initialQuery}`, [
          ...placeholder,
        ]);

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
      "select latitude, longitude from user_location where user_id=? and deleted_at is null",
      [id]
    );

    console.log("userDetails", userDetails);

    if (userDetails?.length) {
      const { latitude, longitude } = userDetails[0];

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

        /* Combine blocked, reported and connected user_ids */
        const ignoreIds = [...blockedUsersId, ...connectedUserIds];

        console.log("ignoreIds", ignoreIds);

        let initialQuery =
          "SELECT users.id, name, image, interests, user_location.cca3, dob, (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(user_location.latitude)) * COS(RADIANS(user_location.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(user_location.latitude)))) AS distance FROM users left join user_location on users.id = user_location.user_id where users.deleted_at is null AND DATE_FORMAT(NOW(), '%Y') - DATE_FORMAT(dob, '%Y') BETWEEN ? AND ? and users.id != ? and not users.id in (?)";

        let placeholder = [
          latitude || "",
          longitude || "",
          latitude || "",
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
          `${initialQuery} having distance <= ? order by distance asc limit ?,?`,
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
            `SELECT COUNT(*) AS count FROM (${getPeopleCount}) AS subquery`
          );

          const totalPages = Math.ceil(peopleCount?.count / limit);
          const currentPage = parseInt(page);

          for (const item of data) {
            const signedUrl = await generateSignedUrl(item.image);
            item.image = signedUrl;
            const flag = countryFlag.find((list) => list.iso3 === item.cca3);
            item.flag = flag?.emoji || null;
            item.isPending = pendingUserIds.includes(item.id);
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
      "select users.id, name, image, mobile, dob, about, interests, city, country, cca3, enable_whatsapp, profile_chat, latitude, longitude, user_block.blocked from users left join user_location on users.id = user_location.user_id left join user_settings on users.id = user_settings.user_id left join (SELECT user_id, GROUP_CONCAT(blocked_to) AS blocked FROM user_block WHERE deleted_at IS NULL GROUP BY user_id) user_block on users.id = user_block.user_id where users.id = ? and users.deleted_at is null",
      [id]
    );

    console.log("userDetails", userDetails);

    if (userDetails?.length) {
      const { id, blocked, image, cca3 } = userDetails[0];
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

        // console.log("connectionIds", connectionIds.data);

        return res.status(200).json({
          userDetails: {
            ...userDetails[0],
            image: signedUrl,
            blocked: blocked && blocked !== "NULL" ? blocked.split(",") : [],
            flag: flag?.emoji,
            isPending: pendingUserIds.includes(id),
          },
        });
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

module.exports = {
  premiumUsers,
  discoverUsers,
  userDetails,
};
