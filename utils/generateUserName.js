const { default: slugify } = require("slugify");
const DB = require("../config/DB");

// Function to check if a user_name exists
async function userNameExists(userName) {
  const [rows] = await DB.query(
    "SELECT COUNT(*) AS count FROM users WHERE user_name = ? and deleted_at is null",
    [userName]
  );
  return rows[0].count > 0;
}

// Function to generate unique user_name with random suffix
async function generateUserName(name, count = 5) {
  const baseUserName = slugify(name, {
    replacement: "_",
    lower: true,
    remove: /[*+~.()'"!:@]/g, // Remove special characters
  });

  const userNames = new Set();

  // Check if the base username exists, and add it if it doesn't
  if (!(await userNameExists(baseUserName))) {
    userNames.add(baseUserName);
  }

  while (userNames.size < count) {
    const randomSuffix = Math.floor(Math.random() * 1000); // Generate random number between 0 and 999
    const userName = `${baseUserName}${randomSuffix}`;

    if (!(await userNameExists(userName))) {
      userNames.add(userName);
    }
  }

  return Array.from(userNames);
}

module.exports = {
  userNameExists,
  generateUserName,
};
