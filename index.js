const express = require("express");
require("dotenv").config();
const { handleTelegramUpdate } = require("./telegram");

const app = express();
app.use(express.json());

app.post("/telegram/webhook", (req, res) => {
  handleTelegramUpdate(req.body);
  res.send("ok");
});

app.listen(3000, () => {
  console.log("Telegram bot server running on port 3000");
});
