import { supabase } from '../../services/supabase'
import type { NormalizedSwapResult, SwapHistoryRow } from '../../types'

export async function persistSwapHistory(userWallet: string, result: NormalizedSwapResult): Promise<void> {
  const row: SwapHistoryRow = {
    user_wallet: userWallet,
    input_mint: result.inputToken.mint,
    output_mint: result.outputToken.mint,
    input_symbol: result.inputToken.symbol,
    output_symbol: result.outputToken.symbol,
    input_amount: result.inputAmount,
    output_amount: result.outputAmount,
    tx_signature: result.txSignature,
    route_summary: result.routeSummary,
    created_at: result.timestamp,
  }
  const insert = await supabase.from('swap_history').insert(row)
  if (insert.error) throw insert.error
}

export async function listRecentSwapHistory(userWallet: string, limit = 6): Promise<SwapHistoryRow[]> {
  const query = await supabase
    .from('swap_history')
    .select('*')
    .eq('user_wallet', userWallet)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (query.error) throw query.error
  return (query.data as SwapHistoryRow[] | null) ?? []
}
