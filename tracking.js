const db = require("./db");

async function addTracking(tgId, chain, address, label, min) {
  const user = await db.query(
    "SELECT id FROM users WHERE telegram_user_id=$1",
    [tgId]
  );

  await db.query(
    `INSERT INTO tracked_addresses
     (user_id, chain, address, label, min_amount, last_seen_cursor)
     VALUES ($1,$2,$3,$4,$5,'0')`,
    [user.rows[0].id, chain, address, label, min]
  );
}

async function viewTracking(tgId) {
  const res = await db.query(
    `SELECT chain,address,label,min_amount
     FROM tracked_addresses
     WHERE user_id=(SELECT id FROM users WHERE telegram_user_id=$1)`,
    [tgId]
  );
  return res.rows;
}

module.exports = { addTracking, viewTracking };
