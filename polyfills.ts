// Must be the very first import — sets up crypto before any Solana code runs
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Buffer global — required by @solana/web3.js
if (typeof (global as Record<string, unknown>).Buffer === 'undefined') {
  (global as Record<string, unknown>).Buffer = Buffer;
}

// TextEncoder/TextDecoder — Hermes (RN 0.78+) ships these natively
// Only polyfill if genuinely missing
if (typeof global.TextEncoder === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const te = require('text-encoding');
    (global as Record<string, unknown>).TextEncoder = te.TextEncoder;
    (global as Record<string, unknown>).TextDecoder = te.TextDecoder;
  } catch { /* skip */ }
}

export {};
