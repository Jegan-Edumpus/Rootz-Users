require("dotenv").config();
const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const compression = require("compression");
const errorHandler = require("./middleware/errorHandler");
const consumer = require("./utils/sqsReceiver");

const PORT = process.env.USERS_PORT || 8001;

app.disable("x-powered-by");
app.use(cors());
app.use(morgan("tiny"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(compression());

/* process error handler */
process.on("uncaughtException", (ex) => {
  console.error("uncaught Exception", ex);
  process.exit(1);
});

process.on("unhandledRejection", (ex) => {
  console.error("Unhandled Rejection", ex);
  process.exit(1);
});

consumer.start();

/* Test API */
app.get("/users", (req, res) => {
  return res.status(200).json({
    uptime: process.uptime(),
    service: "Users",
  });
});

/* API Endpoints */
app.use("/users/api/:version/user", require("./routes/auth"));
app.use("/users/api/:version/interest", require("./routes/interest"));
app.use("/users/api/:version/user/profile", require("./routes/profile"));
app.use("/users/api/:version/events", require("./routes/events"));
app.use("/users/api/:version/people", require("./routes/people"));

// 404 handler
app.all("*", (req, res) => {
  return res.status(404).json({
    error: "404 not found",
  });
});

// error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});
// TestAutomation
