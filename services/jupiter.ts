import axios from 'axios';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  JUPITER_QUOTE_API,
  JUPITER_SWAP_API,
  NATIVE_MINT,
  PLATFORM_FEE_BPS,
  FEE_ACCOUNT_PUBKEY,
  HELIUS_RPC_URL,
  PRIORITY_FEE_NORMAL,
  PRIORITY_FEE_FAST,
} from '../constants/programs';

export type PriorityMode = 'normal' | 'fast' | 'jito';

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: { amount: string; feeBps: number };
  priceImpactPct: string;
  routePlan: unknown[];
  contextSlot: number;
  timeTaken: number;
}

export interface SwapResult {
  txSig: string;
  inputAmount: number;
  outputAmount: number;
}

const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

/** Get a Jupiter quote for a swap */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number
): Promise<QuoteResponse> {
  const feeAccount = FEE_ACCOUNT_PUBKEY;
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountLamports.toString(),
    slippageBps: slippageBps.toString(),
    platformFeeBps: PLATFORM_FEE_BPS.toString(),
    ...(feeAccount !== 'YOUR_FEE_ACCOUNT_PUBKEY' ? { feeAccount } : {}),
  });

  const { data } = await axios.get<QuoteResponse>(`${JUPITER_QUOTE_API}/quote?${params}`);
  return data;
}

/** Check if the fee account's ATA for a given mint exists; create it if not.
 *  Returns the instruction (or null if already exists) */
export async function getOrCreateFeeATAInstruction(
  mint: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction | null> {
  if (FEE_ACCOUNT_PUBKEY === 'YOUR_FEE_ACCOUNT_PUBKEY') return null;

  const feeAccountPk = new PublicKey(FEE_ACCOUNT_PUBKEY);
  const ata = await getAssociatedTokenAddress(mint, feeAccountPk, false);

  try {
    const accountInfo = await connection.getAccountInfo(ata);
    if (accountInfo !== null) return null; // Already exists
  } catch {
    // Account doesn't exist, fall through to create
  }

  return createAssociatedTokenAccountInstruction(
    payer,
    ata,
    feeAccountPk,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/** Build and return a swap transaction from Jupiter */
export async function buildSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: PublicKey,
  priorityMode: PriorityMode
): Promise<VersionedTransaction> {
  const prioritizationFeeLamports =
    priorityMode === 'fast' ? PRIORITY_FEE_FAST : PRIORITY_FEE_NORMAL;

  const outputMint = new PublicKey(quoteResponse.outputMint);
  const feeATAInstruction = await getOrCreateFeeATAInstruction(outputMint, userPublicKey);

  const body: Record<string, unknown> = {
    quoteResponse,
    userPublicKey: userPublicKey.toBase58(),
    wrapAndUnwrapSol: true,
    prioritizationFeeLamports,
    dynamicComputeUnitLimit: true,
  };

  if (feeATAInstruction) {
    // Serialize the extra instruction for Jupiter to include
    body.computeUnitPriceMicroLamports = prioritizationFeeLamports;
  }

  const { data } = await axios.post<{ swapTransaction: string }>(JUPITER_SWAP_API, body);

  const swapTransactionBuf = Buffer.from(data.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  // If we need to create the fee ATA, prepend that instruction
  if (feeATAInstruction) {
    const { blockhash } = await connection.getLatestBlockhash();
    const message = TransactionMessage.decompile(transaction.message);
    message.instructions = [feeATAInstruction, ...message.instructions];
    transaction.message = message.compileToV0Message();
  }

  return transaction;
}

/** Execute a buy: SOL → token */
export async function executeBuy(
  mint: string,
  amountLamports: number,
  slippageBps: number,
  userPublicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  priorityMode: PriorityMode
): Promise<SwapResult> {
  const quote = await getQuote(
    NATIVE_MINT.toBase58(),
    mint,
    amountLamports,
    slippageBps
  );

  const transaction = await buildSwapTransaction(quote, userPublicKey, priorityMode);
  const signed = await signTransaction(transaction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const txSig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature: txSig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return {
    txSig,
    inputAmount: amountLamports,
    outputAmount: parseInt(quote.outAmount, 10),
  };
}

/** Execute a sell: token → SOL */
export async function executeSell(
  mint: string,
  amountTokens: number,
  slippageBps: number,
  userPublicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  priorityMode: PriorityMode
): Promise<SwapResult> {
  const quote = await getQuote(
    mint,
    NATIVE_MINT.toBase58(),
    amountTokens,
    slippageBps
  );

  const transaction = await buildSwapTransaction(quote, userPublicKey, priorityMode);
  const signed = await signTransaction(transaction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const txSig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature: txSig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return {
    txSig,
    inputAmount: amountTokens,
    outputAmount: parseInt(quote.outAmount, 10),
  };
}

/** Fetch SOL balance for an address */
export async function getSOLBalance(publicKey: string): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(publicKey));
  return lamports / LAMPORTS_PER_SOL;
}

/** Get the Solana connection instance */
export function getConnection(): Connection {
  return connection;
}
