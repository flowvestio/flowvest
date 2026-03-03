const express = require("express");
const db = require("./db");

const app = express();

app.get("/api/vests", async (req,res)=>{
  const { owner, beneficiary } = req.query;

  let sql = "SELECT * FROM vests ORDER BY vest_id DESC LIMIT 20";
  let params = [];

  if (beneficiary){
    sql = "SELECT * FROM vests WHERE beneficiary=? ORDER BY vest_id DESC LIMIT 20";
    params = [beneficiary];
  }

  if (owner){
    sql = "SELECT * FROM vests WHERE owner=? ORDER BY vest_id DESC LIMIT 20";
    params = [owner];
  }

  const [rows] = await db.query(sql, params);
  res.json({ items: rows });
});

app.listen(3000, ()=> console.log("API running on 3000"));
