const mysql = require("mysql2/promise");

module.exports = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "你的密码",
  database: "flowvest",
  waitForConnections: true,
  connectionLimit: 5
});
