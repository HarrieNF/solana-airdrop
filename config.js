/* Runtime configuration. No build step required.
   Swap providers here without touching script.js. */
window.AIRDROP_CONFIG = {
  // Helius public mainnet RPC (no key, rate-limited). Replace with your
  // own RPC URL for production traffic.
  rpcEndpoints: [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com"
  ],
  // Metadata providers tried in order. First success wins.
  metadataProviders: [
    { name: "jupiter", url: "https://tokens.jup.ag/token/{ca}" },
    { name: "dexscreener", url: "https://api.dexscreener.com/latest/dex/tokens/{ca}" }
  ],
  // Fallback brand defaults if metadata can't be fetched.
  fallback: {
    name: "Solana Token",
    symbol: "TOKEN",
    image: ""
  },
  ui: {
    minLoaderMs: 1400,
    particleCount: 28
  }
};
