const DB = require("../config/DB");
const createError = require("http-errors");
const generateSignedUrl = require("../utils/generateSignedUrl");
const generateUniqueId = require("../utils/generateUniqueId");
const languageList = require("../utils/languageList");
const countryFlag = require("../utils/countryFlag");
const { location, sns } = require("../config/aws");
const {
  SearchPlaceIndexForPositionCommand,
} = require("@aws-sdk/client-location");
const auth = require("firebase-admin/auth");
const {
  CreatePlatformEndpointCommand,
  SubscribeCommand,
  DeleteEndpointCommand,
  UnsubscribeCommand,
} = require("@aws-sdk/client-sns");
const {
  sendConnectionMessage,
  sendPostMessage,
} = require("../utils/sqsHandler");
const deleteImage = require("../utils/deleteImage");
const mysql = require("mysql2/promise");
const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, USERS_DATABASE } = process.env;

// Create a MySQL2 connection pool
const pool = mysql.createPool({
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: USERS_DATABASE,
});

/* Get user profile details */
const profileDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("id param", id);
    const [profile] = await DB.query(
      `select users.id, profile_id, name, connections, posts, mobile, country_code, dob, gender, about, interests, image, user_block.blocked, user_location.latitude, user_location.longitude, user_location.city, user_location.country, user_location.cca3, user_settings.enable_whatsapp, user_settings.profile_chat, user_settings.status, user_notification.device_arns from users left join user_location on users.id = user_location.user_id left join user_settings on users.id = user_settings.user_id left join user_notification on users.id = user_notification.user_id left join (SELECT user_id, GROUP_CONCAT(blocked_to) AS blocked FROM user_block WHERE deleted_at IS NULL GROUP BY user_id) user_block on users.id = user_block.user_id where users.id = ? and users.deleted_at is null`,
      [id]
    );

    if (profile?.length) {
      const { blocked, image, cca3 } = profile[0];
      const signedUrl = await generateSignedUrl(image);

      const flag = countryFlag.find((list) => list.iso3 === cca3);

      if (!profile[0]?.profile_id) {
        const profileID = generateUniqueId();
        await DB.query("UPDATE users SET profile_id=? WHERE id=?", [
          profileID,
          id,
        ]);
      }
      return res.status(200).json({
        profileDetails: {
          ...profile[0],
          image: signedUrl,
          blocked: blocked && blocked !== "NULL" ? blocked.split(",") : [],
          flag: flag?.emoji,
        },
      });
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update user interests */
const updateInterests = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { interests } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }
    if (!interests || interests.length === 0) {
      return next(createError(400, "Interests required"));
    }

    const [checkUser] = await DB.query(
      "select id from users where id=? and deleted_at is null",
      [id]
    );

    if (checkUser.length) {
      const [profileDetails] = await DB.query(
        "UPDATE users SET interests=? WHERE id=? and deleted_at is null",
        [JSON.stringify(interests), id]
      );

      if (profileDetails.affectedRows) {
        return res
          .status(200)
          .json({ message: "Interests updated successfully" });
      } else {
        return next(createError(400, "Unable to update interests"));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update user profile image */
const uploadProfileImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(createError(400, "User ID required"));
    }
    if (req?.file?.location) {
      // console.log("req.file", req.file);
      const [userDetails] = await DB.query(
        "select id from users where id=? and deleted_at is null",
        [id]
      );

      if (userDetails?.length) {
        /* Get image url from s3 object */
        const image = req?.file?.location
          ?.split("amazonaws.com/")[1]
          ?.replace(/%2F/g, "/");

        const [profileDetails] = await DB.query(
          "update users set image=? where id=? and deleted_at is null",
          [image, id]
        );

        if (profileDetails.affectedRows) {
          const signedUrl = await generateSignedUrl(image);
          return res.status(200).json({
            message: "Profile image uploaded successfully",
            signedUrl,
          });
        } else {
          return next(createError(400, "Unable to upload profile image"));
        }
      } else {
        return next(createError(404, "Account not found"));
      }
    } else {
      return next(createError(400, "Unable to upload profile image"));
    }
  } catch (error) {
    console.log("upload error", error);
    return next(createError(500, error));
  }
};

/* Update user display name */
const updateName = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!name) {
      return next(createError(400, "Name is required"));
    }

    /* check user name is already exist */
    const [checkName] = await DB.query(
      "select id from users where name=? and deleted_at is null",
      [name]
    );

    if (checkName?.length) {
      return next(createError(409, "User name already exist"));
    } else {
      const [profileDetails] = await DB.query(
        "UPDATE users SET name=? WHERE id=? and deleted_at is null",
        [name, id]
      );

      if (profileDetails.affectedRows) {
        await sendConnectionMessage({
          id,
          name,
          action: "UPDATE_NAME",
          to: "CONNECTION",
        });
        return res.status(200).json({ message: "Name updated successfully" });
      } else {
        return next(createError(404, "Account not found"));
      }
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update user about*/
const updateAbout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { about } = req.body;
    if (!id) {
      return next(createError(400, "User ID required"));
    }
    if (!about) {
      return next(createError(400, "About is required"));
    }
    const [profileDetails] = await DB.query(
      "UPDATE users SET about=? WHERE id=? and deleted_at is null",
      [about, id]
    );
    if (profileDetails.affectedRows) {
      return res.status(200).json({ message: "About updated successfully" });
    } else {
      return next(createError(400, "Unable to update about"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update gender */
const updateGender = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { gender } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!gender) {
      return next(createError(400, "Gender is required"));
    }
    const [profileDetails] = await DB.query(
      "UPDATE users SET gender=? WHERE id=? and deleted_at is null",
      [gender, id]
    );

    if (profileDetails.affectedRows) {
      return res.status(200).json({ message: "Gender updated successfully" });
    } else {
      return next(createError(400, "Unable to update gender"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update DOB */

const updateDOB = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dob } = req.body;
    if (!id) {
      return next(createError(400, "User ID required"));
    }
    if (!dob) {
      return next(createError(400, "Date of birth is required"));
    }
    const [profileDetails] = await DB.query(
      "UPDATE users SET dob=? WHERE id=? and deleted_at is null",
      [dob, id]
    );
    if (profileDetails.affectedRows) {
      return res
        .status(200)
        .json({ message: "Date of birth updated successfully" });
    } else {
      return next(createError(400, "Unable to update date of birth"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

// check user mobile number is older or new
const checkMobileExist = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return next(createError(400, "Mobile number required"));
    }

    const [user] = await DB.query(
      "select id from users where mobile=? and deleted_at is null",
      [mobile]
    );

    return res.status(200).json({
      message: "User verified successfully",
      isNewUser: user.length ? false : true,
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Enable whatsapp chat for profile */
const updateWhatsappNumber = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enable_whatsapp } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    const [checkUser] = await DB.query(
      "select id from users where id=? and deleted_at is null",
      [id]
    );

    if (checkUser?.length) {
      const [updateWhatsapp] = await DB.query(
        "UPDATE user_settings SET enable_whatsapp=? WHERE user_id=? and deleted_at is null",
        [enable_whatsapp, id]
      );

      if (updateWhatsapp.affectedRows) {
        return res
          .status(200)
          .json({ message: "Whatsapp status updated successfully" });
      } else {
        return next(createError(400, "Unable to update whatsapp chat status"));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Enable profile chat (chat to anyone before match) */
const enableProfileChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { profile_chat } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    const [checkUser] = await DB.query(
      "select id from users where id=? and deleted_at is null",
      [id]
    );

    if (checkUser?.length) {
      const [updateProfileChat] = await DB.query(
        "UPDATE user_settings SET profile_chat=? WHERE user_id=? and deleted_at is null",
        [profile_chat, id]
      );

      if (updateProfileChat.affectedRows) {
        return res
          .status(200)
          .json({ message: "Profile chat enabled successfully" });
      } else {
        return next(createError(400, "Unable to update profile chat"));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

const getAllCities = async (req, res, next) => {
  const { search = "" } = req.query;
  // const offset = (page - 1) * limit;
  try {
    const [getCities] = await DB.query(
      "select DISTINCT city, country from user_location where city like ? and deleted_at is null order by city asc",
      [`%${search}%`]
    );

    console.log("getCities", getCities);
    if (getCities.length) {
      return res.status(200).json({
        cities: getCities,
      });
    } else {
      return res.status(200).json({
        message: "No result found",
        cities: [],
      });
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Get all language list */
const getAllLanguages = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    const languages = languageList.filter((lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase())
    );

    return res.status(200).json({
      languages,
    });
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update user geolocation */
const updateLocationDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!latitude || !longitude) {
      return next(createError(400, "Latitude and longitude is required"));
    }

    const [checkUser] = await DB.query(
      "select id from users where id=? and deleted_at is null",
      [id]
    );

    if (checkUser?.length) {
      const input = {
        IndexName: process.env.AWS_LOCATION_INDEX,
        Position: [longitude, latitude],
        Language: "en",
        MaxResults: 1,
      };
      const command = new SearchPlaceIndexForPositionCommand(input);
      const response = await location.send(command);

      if (response?.Results?.length) {
        // console.log("response", response?.Results);
        /* Split country by "?" and get the last data */
        const getCountryList =
          response?.Results?.[0]?.Place?.Label?.split(", ");
        const country = getCountryList?.[getCountryList?.length - 1];
        const city =
          response?.Results?.[0]?.Place?.SubRegion ||
          response.Results?.[0]?.Place?.Municipality ||
          country;
        const cca3 = response?.Results?.[0]?.Place?.Country;

        // console.log("city and country", city, country);

        const [profileDetails] = await DB.query(
          "UPDATE user_location SET latitude=?, longitude=?, city=?, country=?, cca3=?  WHERE user_id=? and deleted_at is null",
          [latitude, longitude, city, country, cca3, id]
        );
        if (profileDetails.affectedRows) {
          return res.status(200).json({
            message: "Geolocation updated successfully",
          });
        } else {
          return next(
            createError(400, "Unable to update geolocation, please try again")
          );
        }
      } else {
        return next(
          createError(400, "Unable to update geolocation, please try again")
        );
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Update mobile number */
const updateMobileNumber = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mobile, countryCode = "+91" } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!mobile || !countryCode) {
      return next(createError(400, "Mobile number is required"));
    }

    const [checkUser] = await DB.query(
      "select mobile from users where id=? and deleted_at is null",
      [id]
    );

    if (checkUser.length) {
      // check if req mobile number & user mobile number from DB is same
      // if both true, dont update firebase mobile number
      if (checkUser[0]?.mobile !== mobile) {
        // update mobile number in current firebase user
        const userProperties = {
          phoneNumber: mobile,
        };

        // user_id required to set new mobile number
        const updatePhone = await auth
          .getAuth()
          .updateUser(req.user_id, userProperties);

        if (updatePhone?.uid) {
          const [profileDetails] = await DB.query(
            "UPDATE users SET  mobile=?, country_code=? WHERE id=? and deleted_at is null",
            [mobile, countryCode, id]
          );

          if (profileDetails.affectedRows) {
            return res
              .status(200)
              .json({ message: "Mobile number updated successfully" });
          } else {
            return next(createError(400, "Unable to update mobile number"));
          }
        } else {
          return next(createError(400, "Unable to update mobile number"));
        }
      } else {
        return next(createError(409, "Mobile number already exists"));
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Get blocked users list */
const blockedList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    /* Check user exist */
    const [userDetails] = await DB.query(
      "select id from users where id=? and deleted_at is null",
      [id]
    );

    if (userDetails.length) {
      /* Get blocked users list */
      const [getBlockedList] = await DB.query(
        "select blocked_to from user_block where user_id=? and deleted_at is null",
        [id]
      );

      console.log("getBlockedList", getBlockedList);

      if (getBlockedList?.length) {
        const getBlockedUserIds = getBlockedList.map((item) => item.blocked_to);
        console.log("getBlockedUserIds", getBlockedUserIds);

        const [blockedList] = await DB.query(
          "select user_block.id, users.id as user_id, name, image from users left join user_block on users.id = user_block.blocked_to where users.id in (?) and name like ? and user_block.deleted_at is null order by name limit ?, ?",
          [getBlockedUserIds, `%${search}%`, offset, Number(limit)]
        );

        if (blockedList?.length) {
          for (const item of blockedList) {
            const signedUrl = await generateSignedUrl(item?.image);
            item.image = signedUrl;
          }

          const [countResult] = await DB.query(
            "SELECT COUNT(id) AS count FROM users WHERE id in (?) and name like ? AND deleted_at IS NULL",
            [getBlockedUserIds, `%${search}%`]
          );

          const totalData = countResult[0].count;
          const totalPages = Math.ceil(totalData / limit);
          return res.status(200).json({
            blockedList: blockedList,
            totalPage: totalPages,
            currentPage: parseInt(page),
          });
        } else {
          return res.status(200).json({
            message: "No blocked list found",
            blockedList: [],
          });
        }
      } else {
        return res.status(200).json({
          message: "No blocked list found",
          blockedList: [],
        });
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    console.log("unblock error", error);
    return next(createError(500, error));
  }
};

/* Add device token */
const addDeviceToken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { device_token } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!device_token) {
      return next(createError(400, "Device token is required"));
    }

    const [userDetails] = await DB.query(
      "select * from user_notification where user_id=? and deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      const { device_tokens, device_arns, topic_arns } = userDetails[0];

      /* Parse device tokens */
      const tokens =
        device_tokens && device_tokens !== "NULL"
          ? JSON.parse(device_tokens)
          : [];

      /* Parse device ARNs */
      const arns =
        device_arns && device_arns !== "NULL" ? JSON.parse(device_arns) : [];

      /* Parse topic ARNs */
      const topicArns =
        topic_arns && topic_arns !== "NULL" ? JSON.parse(topic_arns) : [];

      /* Check if device token already exists */
      if (tokens.includes(device_token)) {
        return res.status(200).json({
          message: "Device token already exists",
        });
      } else {
        /* Add new device token with existing device tokens */
        const allDeviceTokens = [...tokens, device_token];

        /* create platform endpoint command
              PlatformApplicationArn --> pass platform ARN
              Token --> pass device token from req.body
            */
        const deviceCommand = new CreatePlatformEndpointCommand({
          PlatformApplicationArn: process.env.SNS_PLATFORM_ARN,
          Token: device_token,
          CustomUserData: req.mobile,
        });

        const platformResult = await sns.send(deviceCommand);

        if (platformResult?.EndpointArn) {
          console.log("platformResult", platformResult);
          /* Add new device arn with existing device arns */
          const allDeviceArns = [
            ...arns,
            platformResult.EndpointArn?.split(process.env.SNS_NAME)[1],
          ];

          const topicCommand = new SubscribeCommand({
            Protocol: "application",
            TopicArn: process.env.SNS_TOPIC_ARN,
            Endpoint: platformResult?.EndpointArn,
          });

          const subscribeToTopic = await sns.send(topicCommand);

          // console.log("subscribeToTopic", subscribeToTopic);

          if (subscribeToTopic?.SubscriptionArn) {
            /* Add new topic arn with existing topic arns */
            const allTopicArns = [
              ...topicArns,
              subscribeToTopic.SubscriptionArn?.split(
                process.env.SNS_TOPIC_NAME
              )[1],
            ];

            /* Stringify all device tokens and update in DB */
            const [addDeviceToken] = await DB.query(
              "update user_notification set device_tokens=?, device_arns=?, topic_arns=? where user_id=? and deleted_at is null",
              [
                JSON.stringify(allDeviceTokens),
                JSON.stringify(allDeviceArns),
                JSON.stringify(allTopicArns),
                id,
              ]
            );

            if (addDeviceToken?.affectedRows) {
              return res.status(200).json({
                message: "Device token added successfully",
              });
            } else {
              return next(createError(400, "Unable to add device token"));
            }
          } else {
            return next(createError(400, "Unable to add device token"));
          }
        } else {
          return next(createError(400, "Unable to add device token"));
        }
      }
    } else {
      return next(createError(404, "Account not found"));
    }
  } catch (error) {
    console.log(" device token error", error);
    return next(createError(500, error));
  }
};

/* Remove device token */
const removeDeviceToken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { device_token } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!device_token) {
      return next(createError(400, "Device token is required"));
    }

    const [userDetails] = await DB.query(
      "select * from user_notification where user_id=? and deleted_at is null",
      [id]
    );

    if (userDetails?.length) {
      const { device_tokens, device_arns, topic_arns } = userDetails[0];

      /* Parse device tokens */
      const tokens =
        device_tokens && device_tokens !== "NULL"
          ? JSON.parse(device_tokens)
          : [];

      /* Parse device ARNs */
      const arns =
        device_arns && device_arns !== "NULL" ? JSON.parse(device_arns) : [];

      /* Parse topic ARNs */
      const topicArns =
        topic_arns && topic_arns !== "NULL" ? JSON.parse(topic_arns) : [];

      if (tokens.length) {
        /* Unmatched records of device tokens*/
        const unMatchedDeviceTokens = [];

        /* Unmatched records of device arns*/
        const unMatchedDeviceArns = [];

        /* Unmatched records of topic arns */
        const unMatchedTopicArns = [];

        /* Initial value of platform arn endpoint to delete*/
        let endPointToDelete = "";

        /* Initial value of topic arn endpoint to delete*/
        let topicArnToDelete = "";

        for (const [index, item] of tokens.entries()) {
          /* If provided device token matched with DB token then add it to endPointToDelete and topicArnToDelete */
          if (item === device_token) {
            endPointToDelete = arns[index];
            topicArnToDelete = topicArns[index];
          } else {
            /* Else push device token, device arns & topic arns to unmatched array*/
            unMatchedDeviceTokens.push(item);
            unMatchedDeviceArns.push(arns[index]);
            unMatchedTopicArns.push(topicArns[index]);
          }
        }

        /* Remove device endpoint arn & device token & device arns from DB only if match found */
        if (endPointToDelete) {
          // console.log(
          //   "un matched data",
          //   unMatchedDeviceArns,
          //   unMatchedDeviceTokens,
          //   unMatchedTopicArns,
          //   endPointToDelete,
          //   topicArnToDelete
          // );

          /* Delete arn command */
          const deleteEndpointCommand = new DeleteEndpointCommand({
            EndpointArn: `${process.env.SNS_ENDPOINT_ARN}${endPointToDelete}`,
          });

          const DeleteEndpoint = await sns.send(deleteEndpointCommand);

          console.log("DeleteEndpoint", DeleteEndpoint);

          if (topicArnToDelete) {
            /* Delete topic arn command */
            const deleteTopicCommand = new UnsubscribeCommand({
              SubscriptionArn: `${process.env.SNS_TOPIC_ARN}:${topicArnToDelete}`,
            });

            const DeleteTopicEndpoint = await sns.send(deleteTopicCommand);

            console.log("DeleteTopicEndpoint", DeleteTopicEndpoint);

            /* Stringify all device tokens and update in DB */
            const [updateDetails] = await DB.query(
              "update user_notification set device_tokens=?, device_arns=?, topic_arns=? where user_id=? and deleted_at is null",
              [
                unMatchedDeviceTokens?.length
                  ? JSON.stringify(unMatchedDeviceTokens)
                  : "NULL",
                unMatchedDeviceArns.length
                  ? JSON.stringify(unMatchedDeviceArns)
                  : "NULL",
                unMatchedTopicArns.length
                  ? JSON.stringify(unMatchedTopicArns)
                  : "NULL",
                id,
              ]
            );

            if (updateDetails?.affectedRows) {
              return res.status(200).json({
                message: "Device token removed successfully",
              });
            } else {
              return next(createError(400, "Unable to remove device token"));
            }
          } else {
            // return next(createError(404, "Device token not found"));
            return res.status(200).json({
              message: "Device token not found",
            });
          }
        } else {
          // return next(createError(404, "Device token not found"));
          return res.status(200).json({
            message: "Device token not found",
          });
        }
      } else {
        // return next(createError(404, "Device token not found"));
        return res.status(200).json({
          message: "Device token not found",
        });
      }
    } else {
      return next(createError(404, "User not found"));
    }
  } catch (error) {
    console.log("remove device token error", error);
    return next(createError(500, error));
  }
};

/* Add APP feedback */
const addFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { star, comment } = req.body;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    if (!star) {
      return next(createError(400, "Feedback is required"));
    }

    const [addFeedback] = await DB.query(
      "insert into feedbacks (user_id, star, comment) values (?, ?, ?)",
      [id, star, comment]
    );

    if (addFeedback.affectedRows) {
      return res.status(200).json({
        message: "Feedback submitted successfully",
      });
    } else {
      return next(
        createError(400, "Unable to submit feedback, please try again")
      );
    }
  } catch (error) {
    return next(createError(500, error));
  }
};

/* Delete account */
const deleteAccount = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    if (!id) {
      return next(createError(400, "User ID required"));
    }

    /* To ensure database operations occur within a transaction. if any operation fails, rollback all changes */
    await connection.beginTransaction();

    /* get userDetails */
    const [userDetails] = await connection.query(
      "select users.id, image, user_notification.device_arns, user_notification.device_tokens, user_notification.topic_arns from users left join user_notification on users.id = user_notification.user_id where users.id=? and users.deleted_at is null",
      [id]
    );

    // console.log("userDetails", userDetails);

    if (userDetails?.length) {
      const { device_tokens, device_arns, topic_arns, image } = userDetails[0];

      /* Parse device tokens */
      const tokens =
        device_tokens && device_tokens !== "NULL"
          ? JSON.parse(device_tokens)
          : [];

      /* Parse device ARNs */
      const arns =
        device_arns && device_arns !== "NULL" ? JSON.parse(device_arns) : [];

      /* Parse topic ARNs */
      const topicArns =
        topic_arns && topic_arns !== "NULL" ? JSON.parse(topic_arns) : [];

      /* Soft delete reports table */
      await connection.query(
        "update reports set deleted_at=NOW() where user_id=? and deleted_at is null",
        [id]
      );

      /* Soft delete user_block table */
      await connection.query(
        "update user_block set deleted_at=NOW() where user_id=? and deleted_at is null",
        [id]
      );

      /* Soft delete user_location table */
      await connection.query(
        "update user_location set deleted_at=NOW() where user_id=? and deleted_at is null",
        [id]
      );

      /* Soft delete user_notification table */
      await connection.query(
        "update user_notification set deleted_at=NOW() where user_id=? and deleted_at is null",
        [id]
      );

      /* Soft delete user_settings table */
      await connection.query(
        "update user_settings set deleted_at=NOW() where user_id=? and deleted_at is null",
        [id]
      );

      /* Soft delete subscription table */
      await connection.query(
        "update subscription set deleted_at=NOW() where user_id=? and deleted_at is null",
        [id]
      );

      const [deleteUser] = await connection.query(
        "update users set deleted_at=NOW() where id=? and deleted_at is null",
        [id]
      );

      if (deleteUser.affectedRows) {
        await connection.commit();
        /* Remove user image */
        await deleteImage(image);

        for (const device_arn of arns) {
          const deleteEndpointCommand = new DeleteEndpointCommand({
            EndpointArn: `${process.env.SNS_ENDPOINT_ARN}${device_arn}`,
          });
          const DeleteEndpoint = await sns.send(deleteEndpointCommand);
          console.log("DeleteEndpoint", DeleteEndpoint);
        }

        for (const topic of topicArns) {
          const deleteTopicCommand = new UnsubscribeCommand({
            SubscriptionArn: `${process.env.SNS_TOPIC_ARN}:${topic}`,
          });
          const DeleteTopicEndpoint = await sns.send(deleteTopicCommand);
          console.log("DeleteTopicEndpoint", DeleteTopicEndpoint);
        }

        await sendConnectionMessage({
          user_id: id,
          action: "DELETE_CONNECTION",
          to: "CONNECTION",
        });

        await sendPostMessage({
          user_id: id,
          action: "REMOVE_POST",
          to: "POST",
        });
        return res.status(200).json({
          message: "Account deleted successfully",
        });
      } else {
        await connection.rollback();
        return res.status(400).json({
          message: "unable to delete account",
        });
      }
    } else {
      return res.status(404).json({
        message: "Account not found",
      });
    }
  } catch (error) {
    await connection.rollback();
    return next(createError(500, error));
  }
};

module.exports = {
  profileDetails,
  updateName,
  uploadProfileImage,
  updateInterests,
  updateAbout,
  updateGender,
  updateDOB,
  checkMobileExist,
  updateWhatsappNumber,
  enableProfileChat,
  getAllCities,
  getAllLanguages,
  updateLocationDetails,
  updateMobileNumber,
  blockedList,
  addDeviceToken,
  removeDeviceToken,
  addFeedback,
  deleteAccount,
};
