import axios from 'axios';
import {
  VersionedTransaction,
  SystemProgram,
  PublicKey,
  TransactionMessage,
  Connection,
} from '@solana/web3.js';
import {
  JITO_BLOCK_ENGINE,
  JITO_TIP_ACCOUNT,
  JITO_TIP_LAMPORTS,
  HELIUS_RPC_URL,
} from '../constants/programs';

const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

export interface JitoBundleResult {
  bundleId: string;
  txSig: string;
}

/**
 * Wrap a transaction in a Jito bundle with a tip transaction and submit.
 * Returns the bundle ID and original tx signature.
 */
export async function sendJitoBundle(
  transaction: VersionedTransaction,
  userPublicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<JitoBundleResult> {
  // Build tip transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const tipInstruction = SystemProgram.transfer({
    fromPubkey: userPublicKey,
    toPubkey: JITO_TIP_ACCOUNT,
    lamports: JITO_TIP_LAMPORTS,
  });

  const tipMessage = new TransactionMessage({
    payerKey: userPublicKey,
    recentBlockhash: blockhash,
    instructions: [tipInstruction],
  }).compileToV0Message();

  const tipTx = new VersionedTransaction(tipMessage);
  const signedTip = await signTransaction(tipTx);
  const signedMain = await signTransaction(transaction);

  // Serialize both transactions to base64
  const bundle = [
    Buffer.from(signedMain.serialize()).toString('base64'),
    Buffer.from(signedTip.serialize()).toString('base64'),
  ];

  const { data } = await axios.post<{ result: string }>(
    JITO_BLOCK_ENGINE,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [bundle],
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  if (!data.result) throw new Error('Jito bundle submission failed: no bundle ID returned');

  const bundleId = data.result;

  // Extract the main transaction signature
  // Solana signatures must be base58-encoded (not base64)
  const bs58 = require('bs58') as typeof import('bs58');
  const txSig = bs58.encode(signedMain.signatures[0]);

  // Wait for confirmation via RPC
  await connection.confirmTransaction(
    { signature: txSig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return { bundleId, txSig };
}

/** Poll Jito bundle status */
export async function getBundleStatus(bundleId: string): Promise<string> {
  try {
    const { data } = await axios.post<{ result: { value: Array<{ confirmation_status: string }> } }>(
      JITO_BLOCK_ENGINE,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBundleStatuses',
        params: [[bundleId]],
      },
      { timeout: 10000 }
    );
    return data?.result?.value?.[0]?.confirmation_status ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
