const https = require("https");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const HOST = "api.telegram.org";

// Force IPv4 (your environment needs this)
const agent = new https.Agent({ family: 4 });

function sendMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text
    });

    const options = {
      hostname: HOST,
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      agent,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = https.request(options, res => {
      res.on("data", () => {});
      res.on("end", resolve);
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

module.exports = { sendMessage };
