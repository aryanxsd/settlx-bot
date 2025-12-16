const https = require("https");
const db = require("./db");
const { checkWallet } = require("./check");
const { addTracking, viewTracking } = require("./tracking");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const HOST = "api.telegram.org";

function sendMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text,
    });

    const options = {
      hostname: HOST,
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      family: 4, // 🔑 FORCE IPV4 (THIS IS THE KEY)
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", resolve);
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function handleTelegramUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  await db.query(
    "INSERT INTO users (telegram_user_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [chatId]
  );

  if (text === "/start" || text === "/menu") {
    return sendMessage(
      chatId,
      "Commands:\n/check <chain> <address>\n/tracking add <chain> <address> <label> <min>\n/tracking view\n/help"
    );
  }

  if (text === "/help") {
    return sendMessage(
      chatId,
      "/check <chain> <address>\n/tracking add <chain> <address> <label> <min>\n/tracking view"
    );
  }

  if (text.startsWith("/check")) {
    const [, chain, address] = text.split(" ");
    if (!chain || !address) {
      return sendMessage(chatId, "Usage: /check <chain> <address>");
    }
    const result = await checkWallet(chain, address);
    return sendMessage(chatId, JSON.stringify(result, null, 2));
  }

    if (text === "/tracking") {
  return sendMessage(
    chatId,
    "Tracking commands:\n" +
    "/tracking add <chain> <address> <label> <min_amount>\n" +
    "/tracking view"
  );
}

  if (text.startsWith("/tracking add")) {
    const [, , chain, address, label, min] = text.split(" ");
    if (!chain || !address || !label || min === undefined) {
      return sendMessage(
        chatId,
        "Usage: /tracking add <chain> <address> <label> <min_amount>"
      );
    }
    await addTracking(chatId, chain, address, label, min);
    return sendMessage(chatId, "Success, now tracking...");
  }

  if (text === "/tracking view") {
    const list = await viewTracking(chatId);
    return sendMessage(chatId, JSON.stringify(list, null, 2));
  }

  return sendMessage(chatId, "Unknown command. Use /help");
}

module.exports = { handleTelegramUpdate, sendMessage };

