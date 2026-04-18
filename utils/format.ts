/** Format a lamport amount to SOL with 4 decimal places */
export function formatSOL(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toFixed(4);
}

/** Format a SOL float to display string with 4dp */
export function formatSOLValue(sol: number): string {
  return sol.toFixed(4);
}

/** Format a USD value with 2dp and $ prefix */
export function formatUSD(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Format a large number with K/M/B suffix */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

/** Format a percentage with 1dp */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** Truncate a wallet address: first 4 + ... + last 4 chars */
export function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/** Format a timestamp to "Xs ago" / "Xm ago" / "Xh ago" */
export function formatAge(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

/** Convert SOL to lamports */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1_000_000_000);
}

/** Convert lamports to SOL */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/** Format market cap: $1.23M / $456K / $789 */
export function formatMarketCap(value: number): string {
  if (!value || value <= 0) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/** Format SOL from a raw SOL float (4dp) */
export function formatSOLFromSol(sol: number): string {
  if (!sol || sol <= 0) return '0.0000';
  return sol.toFixed(4);
}

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

/** Convert ipfs:// or /ipfs/<hash> URIs to an HTTP gateway URL React Native can load */
export function toHttpUrl(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return IPFS_GATEWAY + uri.slice(7);
  const match = uri.match(/\/ipfs\/(Qm\w{40,}|bafy\w+)/);
  if (match) return IPFS_GATEWAY + match[1];
  return uri;
}

/** Format a price with appropriate decimal places */
export function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.001) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  return formatUSD(price);
}
