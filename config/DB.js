const mysql = require("mysql2");
const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, DATABASE } = process.env;

const config = {
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: DATABASE,
};

const connection = mysql.createPool({ ...config, multipleStatements: true });

connection.on("acquire", (thread) => {
  console.log("pool", thread.threadId);
});
connection.on("release", (thread) => {
  console.log("released", thread.threadId);
});
connection.on("enqueue", () => {
  console.log("waiting for connection");
});
connection.on("error", function (err) {
  console.log("error", err.code); // 'ER_BAD_DB_ERROR'
});

connection.getConnection((err, conn) => {
  if (err) console.log(JSON.stringify(err));
  else {
    console.log("Connected!");
    try {
      conn.release();
    } catch (error) {
      console.log("connection error", error);
    }
  }
});

module.exports = connection.promise();
