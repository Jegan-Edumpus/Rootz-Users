const { default: axios } = require("axios");
const createError = require("http-errors");

async function getPostCount({ user_id = null }) {
  try {
    console.log({ user_id });
    if (!user_id) {
      throw new Error(createError(400, "user_id is required"));
    }
    const postData = await axios.post(
      `${process.env.POSTS_BASEURL}/post-count`,
      {
        user_id: [user_id],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("postData", postData?.data);
    if (postData.data.statusCode === 200) {
      const count = postData.data?.count || null;
      return count;
    } else if (postData.data.statusCode === 400) {
      return null;
    } else {
      return null;
    }
  } catch (error) {
    console.log("fetch post count error --------", error);
    throw new Error(createError(500, error));
  }
}

async function getConnectionCount({ user_id = null }) {
  try {
    console.log({ user_id });
    if (!user_id) {
      throw new Error(createError(400, "user_id is required"));
    }
    const result = await axios.post(
      `${process.env.CONNECTIONS_BASEURL}/connection-count`,
      {
        user_id,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("resultData", result?.data);
    if (result.data.statusCode === 200) {
      const count = result.data?.count || null;
      return count;
    } else if (result.data.statusCode === 400) {
      return null;
    } else {
      return null;
    }
  } catch (error) {
    console.log("fetch connection count error --------", error);
    throw new Error(createError(500, error));
  }
}
module.exports = {
  getPostCount,
  getConnectionCount,
};
