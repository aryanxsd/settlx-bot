const { ethers } = require("ethers");
const { Connection, PublicKey } = require("@solana/web3.js");
require("dotenv").config();

async function checkWallet(chain, address) {
  let txCount = 0;
  let balance = 0;
  const reasons = [];

  if (chain !== "sol") {
    const rpc = process.env[`${chain.toUpperCase()}_RPC`];
    const provider = new ethers.JsonRpcProvider(rpc);

    // Activity proxy
    txCount = await provider.getTransactionCount(address);

    // Balance proxy (acts as inflow indicator)
    const bal = await provider.getBalance(address);
    balance = Number(ethers.formatEther(bal));

  } else {
    const conn = new Connection(process.env.SOL_RPC);
    const pubkey = new PublicKey(address);
    const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 20 });
    txCount = sigs.length;
  }

  // Simple heuristic scoring (as requested)
  let riskScore = 0;

  if (txCount > 50) {
    riskScore += 40;
    reasons.push("High transaction count");
  }

  if (balance > 10) {
    riskScore += 40;
    reasons.push("Large wallet balance");
  }

  const riskLevel =
    riskScore > 60 ? "High" :
    riskScore > 30 ? "Medium" :
    "Low";

  return {
    riskScore,
    riskLevel,
    reasons,
    recentActivity: txCount,
    explorerLink:
      chain === "sol"
        ? `https://solscan.io/account/${address}`
        : `https://etherscan.io/address/${address}`
  };
}

module.exports = { checkWallet };
