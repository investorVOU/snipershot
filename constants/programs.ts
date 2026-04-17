import { PublicKey } from '@solana/web3.js';

// Solana native
export const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bx');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');

// Pump.fun
export const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const PUMPFUN_MIGRATION_PROGRAM = new PublicKey('39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg');

// Jupiter
export const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
export const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
export const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// Raydium
export const RAYDIUM_AMM_PROGRAM = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
export const RAYDIUM_LIQUIDITY_PROGRAM = new PublicKey('5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h');

// Jito
export const JITO_BLOCK_ENGINE = 'https://mainnet.block-engine.jito.labs.io/api/v1/bundles';
export const JITO_TIP_ACCOUNT = new PublicKey('96gYZGLnJYVFmbjzoperd5HCPnBWEEzRSBU7R2JGrGS');
export const JITO_TIP_LAMPORTS = 1_000_000; // 0.001 SOL

// Helius
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_KEY}`;
export const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_KEY}`;

// Birdeye
export const BIRDEYE_API = 'https://public-api.birdeye.so';

// Pump.fun REST
export const PUMPFUN_API = 'https://frontend-api.pump.fun';

// Fee config
export const PLATFORM_FEE_BPS = 50; // 0.5%
export const FEE_ACCOUNT_PUBKEY = process.env.EXPO_PUBLIC_FEE_ACCOUNT ?? 'YOUR_FEE_ACCOUNT_PUBKEY';

// Priority fees (lamports)
export const PRIORITY_FEE_NORMAL = 50_000;
export const PRIORITY_FEE_FAST = 200_000;
