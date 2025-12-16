const { sendMessage } = require("./telegram");
const { ethers } = require("ethers");
const { Connection, PublicKey } = require("@solana/web3.js");
const https = require("https");
const db = require("./db");
require("dotenv").config();

const CHAINS = [
  { name: "eth", rpc: process.env.ETH_RPC },
  { name: "base", rpc: process.env.BASE_RPC },
  { name: "avax", rpc: process.env.AVAX_RPC }
];

// Force IPv4 agent (CRITICAL for your environment)
const agent = new https.Agent({ family: 4 });

function evmProvider(rpc) {
  return new ethers.JsonRpcProvider(rpc, {
    staticNetwork: true,
    fetchOptions: { agent }
  });
}

async function processEVM(chain) {
  const provider = evmProvider(chain.rpc);

  const latestBlock = await provider.getBlockNumber();

  const tracked = await db.query(
    "SELECT * FROM tracked_addresses WHERE chain=$1 AND is_active=true",
    [chain.name]
  );

  for (const row of tracked.rows) {
    const fromBlock = row.last_seen_cursor
      ? Number(row.last_seen_cursor) + 1
      : latestBlock - 3;

    for (let b = fromBlock; b <= latestBlock; b++) {
      const block = await provider.getBlock(b, true);
      if (!block || !block.transactions) continue;

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

        console.log(
          `[ALERT] ${chain.name.toUpperCase()} ${amount} ETH tx: ${tx.hash}`
        );
      }
    }

    await db.query(
      "UPDATE tracked_addresses SET last_seen_cursor=$1 WHERE id=$2",
      [latestBlock, row.id]
    );
  }
}

async function processSolana() {
  const conn = new Connection(process.env.SOL_RPC, "confirmed");

  const tracked = await db.query(
    "SELECT * FROM tracked_addresses WHERE chain='sol' AND is_active=true"
  );

  for (const row of tracked.rows) {
    const pubkey = new PublicKey(row.address);

    const sigs = await conn.getSignaturesForAddress(pubkey, {
      limit: 10,
      until: row.last_seen_cursor || undefined
    });

    for (const sig of sigs) {
      const tx = await conn.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0
      });
      if (!tx) continue;

      const amount =
        (tx.meta?.postBalances?.[0] - tx.meta?.preBalances?.[0]) / 1e9;

      if (Math.abs(amount) < Number(row.min_amount)) continue;

      const exists = await db.query(
        `SELECT 1 FROM alert_events
         WHERE chain='sol' AND tx_hash_or_sig=$1 AND tracked_address_id=$2`,
        [sig.signature, row.id]
      );

      if (exists.rowCount > 0) continue;

      await db.query(
        `INSERT INTO alert_events
         (tracked_address_id, chain, tx_hash_or_sig, direction, amount, asset, sent_to_telegram)
         VALUES ($1,'sol',$2,$3,$4,'SOL',true)`,
        [
          row.id,
          sig.signature,
          amount > 0 ? "in" : "out",
          Math.abs(amount)
        ]
      );

      console.log(`[ALERT] SOL ${amount} tx: ${sig.signature}`);
    }

    if (sigs.length > 0) {
      await db.query(
        "UPDATE tracked_addresses SET last_seen_cursor=$1 WHERE id=$2",
        [sigs[0].signature, row.id]
      );
    }
  }
}

async function runWorker() {
  try {

    // ===== DEMO MODE (STEP 3 CHANGE IS HERE) =====
    if (process.env.DEMO_MODE === "true") {
      const demoAlert =
`🚨 New Wallet Activity Detected (DEMO)

Chain: Ethereum
Label: bitfinex_whale
Direction: IN
Amount: 2.5 ETH

Tx: 0xDEMO_TX_HASH
Explorer:
https://etherscan.io/tx/0xDEMO_TX_HASH`;

      const users = await db.query(
        "SELECT telegram_user_id FROM users LIMIT 1"
      );

      if (users.rows.length > 0) {
        await sendMessage(users.rows[0].telegram_user_id, demoAlert);
      }

      console.log("✅ Demo alert sent");
      return; // ⬅️ IMPORTANT: stop real polling in demo
    }
    // ===== END DEMO MODE =====

    // REAL LIVE POLLING (unchanged)
    for (const chain of CHAINS) {
      await processEVM(chain);
    }
    await processSolana();

  } catch (err) {
    console.error("Worker error:", err.message);
  }
}


// Run every 60s (as required)
setInterval(runWorker, 60000);
console.log("Tracking worker started...");
