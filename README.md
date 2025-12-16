🛡️ SettlX – AML-style Wallet Monitoring Telegram Bot

A lightweight AML-style monitoring system built as a Telegram bot.
It performs heuristic wallet risk checks and wallet activity tracking with alerts across EVM chains and Solana using a polling-based worker.

This project intentionally avoids paid AML providers and heavy indexing, focusing on clarity, explainability, and low cost, as required.

✨ Features
# Wallet Risk Check (/check)

Heuristic AML-style risk score (0–100)

Risk level: Low / Medium / High

Clear reasons for the score

Recent activity snapshot

Blockchain explorer link

 # Wallet Tracking & Alerts (/tracking)

Track wallets with thresholds

Receive Telegram alerts on new activity

Cursor-based polling

Deduplication to avoid duplicate alerts

# Demo & Live Modes

Demo mode to simulate alerts (safe for restricted environments)

Live mode to poll real blockchains

# Supported Chains

Ethereum

Base

Avalanche

Solana

# High-Level Architecture:
Telegram User
     │
     ▼
Telegram Webhook (/telegram/webhook)
     │
     ▼
Node.js Bot Server (index.js)
     │
     ├── /check → heuristic risk analysis
     ├── /tracking add/view → DB persistence
     │
     ▼
PostgreSQL (users, tracked_addresses, alert_events)
     │
     ▼
Polling Worker (worker.js, every 30–60s)
     │
     ├── scan chains
     ├── apply thresholds
     ├── dedupe alerts
     └── send Telegram alerts


 # Project Struct:
settlx-bot/
├── index.js          # Express server + Telegram webhook
├── telegram.js       # Telegram message handling
├── check.js          # Wallet risk scoring logic
├── tracking.js       # Tracking DB helpers
├── worker.js         # Polling worker for alerts
├── db.js             # PostgreSQL connection
├── schema.sql        # Database schema
├── README.md
├── .gitignore



# Database Schema (Logic):
users

Stores Telegram users.

tracked_addresses

Stores wallets being tracked:

chain

address

label

min_amount

last_seen_cursor (block number or signature)

is_active

alert_events

Stores alerts already sent to ensure deduplication.

🔍 /check – Risk Scoring Logic
What it does

Checks a wallet and returns an explainable risk assessment.

Heuristic Signals Used

Transaction count → proxy for activity

Wallet balance / inflow proxy

Recent activity snapshot

Example Output
{
  "riskScore": 80,
  "riskLevel": "High",
  "reasons": [
    "High transaction count",
    "Large wallet balance"
  ],
  "recentActivity": 2952,
  "explorerLink": "https://etherscan.io/address/0x..."
}

Why heuristic?

No paid AML APIs

Transparent logic

Fast and cheap

Exactly as requested

📡 /tracking – Wallet Tracking Logic
Commands
/tracking
/tracking add <chain> <address> <label> <min_amount>
/tracking view

Example
/tracking add eth 0x742d35Cc... bitfinex_whale 1

🔄 Polling Worker (Core Requirement)
Schedule

Runs every 60 seconds

setInterval(runWorker, 60000);

⛓️ EVM Polling Logic (ETH / Base / Avalanche)

For each chain:

Get latest block number

Determine start block using last_seen_cursor

Scan only recent blocks (not full history)

For each transaction:

Match from / to against tracked address

Parse amount

Check amount >= min_amount

Deduplicate

Send Telegram alert

Update cursor

✔ Matches assignment pseudocode exactly
✔ Avoids over-indexing
✔ Cost-efficient

☀️ Solana Polling Logic

For each tracked SOL address:

Fetch new signatures since last cursor

Fetch transaction details

Calculate balance delta

Apply threshold

Deduplicate

Alert

Update cursor

🔁 Deduplication Strategy

Alerts are deduplicated using:

(chain, tx_hash_or_signature, tracked_address_id)


This guarantees:

No duplicate alerts

Idempotent worker runs

Safe retries

🧪 Demo Mode vs Live Mode
Demo Mode (Recommended for demo/interview)
DEMO_MODE=true


Sends one simulated alert

No dependency on live blockchain traffic

Demonstrates end-to-end alert flow

Clearly marked as (DEMO)

Example alert:

🚨 New Wallet Activity Detected (DEMO)
Tx: DEMO_TX_HASH (simulation)

Live Mode
DEMO_MODE=false


Polls real blockchains

Sends alerts only on real activity

Same logic as demo mode


# Setup & Run (Step-by-Step)

This section explains how to set up, run, stop, and restart the bot on a local machine.

🔹 PART 1: Initial Setup (Run Once)
Step 1️⃣ Clone the repository
git clone <repository>
cd settlx-bot

Step 2️⃣ Install dependencies
npm install

Step 3️⃣ Create .env file

Create a file named .env in the project root:

BOT_TOKEN=<telegram_bot_token>

ETH_RPC=https://rpc.ankr.com/eth
BASE_RPC=https://rpc.ankr.com/base
AVAX_RPC=https://rpc.ankr.com/avalanche
SOL_RPC=https://api.mainnet-beta.solana.com

DEMO_MODE=true


⚠️ Never commit .env to GitHub.

Step 4️⃣ Create PostgreSQL database

Open PostgreSQL:

psql -U postgres


Run:

CREATE DATABASE settlx;
CREATE USER settlx_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE settlx TO settlx_user;


Exit:

\q

Step 5️⃣ Load database schema
psql -h localhost -U settlx_user -d settlx -f schema.sql


✅ Database setup complete.

🔹 PART 2: Run the Bot (Local)

You need 3 terminal windows/tabs.

Step 6️⃣ Start the Telegram bot server

Terminal 1

cd ~/settlx-bot
NODE_OPTIONS="--dns-result-order=ipv4first" node index.js


Expected output:

Telegram bot server running on port 3000

Step 7️⃣ Start the tracking worker

Terminal 2

cd ~/settlx-bot
NODE_OPTIONS="--dns-result-order=ipv4first" node worker.js


Expected output:

Tracking worker started...

Step 8️⃣ Start Cloudflare tunnel (for webhook)

Terminal 3

cloudflared tunnel --url http://localhost:3000


You will see a public URL like:

https://abcd.trycloudflare.com

Step 9️⃣ Set Telegram webhook (IMPORTANT)

Replace values and run:

curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://abcd.trycloudflare.com/telegram/webhook"


Expected response:

{"ok":true,"result":true,"description":"Webhook was set"}


✅ The bot is now fully operational.

🔹 PART 3: How to Run Again (After Laptop Restart)

When you shut down your laptop:

Node processes stop

Cloudflare tunnel stops

Webhook URL expires

Follow these steps to restart.

Step 1️⃣ Open terminal
cd ~/settlx-bot

Step 2️⃣ Start bot server

Terminal 1

NODE_OPTIONS="--dns-result-order=ipv4first" node index.js

Step 3️⃣ Start worker

Terminal 2

cd ~/settlx-bot
NODE_OPTIONS="--dns-result-order=ipv4first" node worker.js

Step 4️⃣ Start Cloudflare tunnel

Terminal 3

cloudflared tunnel --url http://localhost:3000


Copy the new URL shown.

Step 5️⃣ Update Telegram webhook

Run (with new URL):

curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://NEW_URL.trycloudflare.com/telegram/webhook"


The bot is now fully operational.

# Postman / cURL Examples
Set Telegram Webhook
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<PUBLIC_URL>/telegram/webhook"

/check (Telegram → Backend)

Telegram command:

/check eth 0x742d35Cc6634C0532925a3b844Bc454e4438f44e


Example response:

{
  "riskScore": 80,
  "riskLevel": "High",
  "reasons": [
    "High transaction count",
    "Large wallet balance"
  ],
  "recentActivity": 2952,
  "explorerLink": "https://etherscan.io/address/0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}

/tracking add

Telegram command:

/tracking add eth 0x742d35Cc6634C0532925a3b844Bc454e4438f44e bitfinex_whale 1


Response:

Success, now tracking...

/tracking view

Telegram command:

/tracking view


Example response:

[
  {
    "chain": "eth",
    "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "label": "bitfinex_whale",
    "min_amount": "1"
  }
]

# Design Explanation (Short)
Polling Approach

A background worker runs every 30–60 seconds.
For EVM chains, it scans new blocks since the last cursor and checks transactions against tracked addresses.
For Solana, it fetches new signatures since the last stored signature.
Polling was chosen for simplicity and predictable cost.

Risk Scoring Heuristic

Risk score (0–100) is calculated using simple heuristics:

Transaction volume

Recent activity velocity

Large inflow patterns

Scores are mapped to Low / Medium / High risk levels.
No external AML providers are used.

Deduplication + Cursor Logic

Each alert is deduplicated using
(chain, tx_hash_or_signature, tracked_address_id)

Each tracked address stores a last_seen_cursor

Cursor is updated after successful processing to avoid reprocessing

This ensures no duplicate alerts and efficient scanning.

EVM chains share the same polling logic.
Solana uses signature-based polling.
