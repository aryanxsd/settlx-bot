const { sendMessage } = require("./telegram");
const { ethers } = require("ethers");
const { Connection, PublicKey } = require("@solana/web3.js");
const https = require("https");
const db = require("./db");
require("dotenv").config();

/**
 * Force IPv4 (important for your environment)
 */
const agent = new https.Agent({ family: 4 });

/**
 * ===== DEMO MODE =====
 * NOTHING RPC-RELATED IS TOUCHED HERE
 */
async function runDemoOnce() {
  const exists = await db.query(
    "SELECT 1 FROM alert_events WHERE tx_hash_or_sig='DEMO_TX'"
  );

  if (exists.rowCount > 0) {
    console.log("Demo alert already sent");
    return;
  }

  const users = await db.query("SELECT telegram_user_id FROM users LIMIT 1");
  if (users.rows.length === 0) return;

  await sendMessage(
    users.rows[0].telegram_user_id,
`🚨 Demo Wallet Activity

Chain: Ethereum
Label: demo_wallet
Direction: IN
Amount: 2.5 ETH

Tx: DEMO_TX
Explorer:
https://etherscan.io/tx/DEMO_TX`
  );

  await db.query(
    `INSERT INTO alert_events
     (tracked_address_id, chain, tx_hash_or_sig, direction, amount, asset, sent_to_telegram)
     VALUES (NULL,'eth','DEMO_TX','in',2.5,'ETH',true)`
  );

  console.log("✅ Demo alert sent");
}

/**
 * ===== LIVE PROVIDERS (CREATED ONLY IN LIVE MODE) =====
 */
function evmProvider(rpc) {
  return new ethers.JsonRpcProvider(rpc, undefined, {
    fetchOptions: { agent }
  });
}

/**
 * ===== LIVE WORKER =====
 */
async function runLiveWorker() {
  const CHAINS = [
    { name: "eth", rpc: process.env.ETH_RPC },
    { name: "base", rpc: process.env.BASE_RPC },
    { name: "avax", rpc: process.env.AVAX_RPC }
  ];

  for (const chain of CHAINS) {
    const provider = evmProvider(chain.rpc);
    const latestBlock = await provider.getBlockNumber();

    const tracked = await db.query(
      "SELECT * FROM tracked_addresses WHERE chain=$1 AND is_active=true",
      [chain.name]
    );

    for (const row of tracked.rows) {
      const fromBlock = row.last_seen_cursor
        ? Number(row.last_seen_cursor) + 1
        : latestBlock - 2;

      for (let b = fromBlock; b <= latestBlock; b++) {
        const block = await provider.getBlock(b, true);
        if (!block?.transactions) continue;

        for (const tx of block.transactions) {
          if (!tx.to && !tx.from) continue;

          const match =
            tx.to?.toLowerCase() === row.address.toLowerCase() ||
            tx.from?.toLowerCase() === row.address.toLowerCase();

          if (!match) continue;

          const amount = Number(ethers.formatEther(tx.value || 0));
          if (amount < Number(row.min_amount)) continue;

          const exists = await db.query(
            `SELECT 1 FROM alert_events
             WHERE chain=$1 AND tx_hash_or_sig=$2 AND tracked_address_id=$3`,
            [chain.name, tx.hash, row.id]
          );

          if (exists.rowCount > 0) continue;

          await db.query(
            `INSERT INTO alert_events
             (tracked_address_id, chain, tx_hash_or_sig, direction, amount, asset, sent_to_telegram)
             VALUES ($1,$2,$3,$4,$5,$6,true)`,
            [
              row.id,
              chain.name,
              tx.hash,
              tx.to?.toLowerCase() === row.address.toLowerCase() ? "in" : "out",
              amount,
              "ETH"
            ]
          );

          await sendMessage(
            row.telegram_user_id,
`🚨 New Wallet Activity

Chain: ${chain.name.toUpperCase()}
Label: ${row.label}
Amount: ${amount} ETH
Tx: ${tx.hash}`
          );
        }
      }

      await db.query(
        "UPDATE tracked_addresses SET last_seen_cursor=$1 WHERE id=$2",
        [latestBlock, row.id]
      );
    }
  }
}

/**
 * ===== MAIN LOOP =====
 */
async function runWorker() {
  try {
    if (process.env.DEMO_MODE === "true") {
      await runDemoOnce();
      return;
    }

    await runLiveWorker();

  } catch (err) {
  console.error("Worker error:", err);
  console.error("Message:", err?.message);
  console.error("Stack:", err?.stack);
}

}

setInterval(runWorker, 60000);
console.log("Tracking worker started...");
