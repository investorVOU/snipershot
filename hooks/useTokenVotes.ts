import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface VoteState {
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
}

export function useTokenVotes(mint: string) {
  const [votes, setVotes] = useState<VoteState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ── Fetch current user id ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setUserId(sess?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load vote counts + user's own vote ─────────────────────────────────────
  useEffect(() => {
    if (!mint) return;
    let cancelled = false;

    async function load() {
      // Aggregate counts in one query
      const [{ data: counts }, { data: myVote }] = await Promise.all([
        supabase
          .from('token_votes')
          .select('vote_type')
          .eq('mint', mint),
        userId
          ? supabase
              .from('token_votes')
              .select('vote_type')
              .eq('mint', mint)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      const up = counts?.filter((r) => r.vote_type === 'up').length ?? 0;
      const down = counts?.filter((r) => r.vote_type === 'down').length ?? 0;
      setVotes({
        upvotes: up,
        downvotes: down,
        userVote: (myVote?.vote_type as 'up' | 'down' | null) ?? null,
      });
    }

    load().catch(() => {});
    return () => { cancelled = true; };
  }, [mint, userId]);

  // ── Vote action ────────────────────────────────────────────────────────────
  const vote = useCallback(async (type: 'up' | 'down') => {
    if (!userId) return; // must be logged in

    const current = votes?.userVote;

    // Optimistic UI update
    setVotes((prev) => {
      if (!prev) return prev;
      const isToggle = current === type;
      return {
        upvotes: prev.upvotes
          + (type === 'up' && !isToggle ? 1 : 0)
          - (current === 'up' ? 1 : 0),
        downvotes: prev.downvotes
          + (type === 'down' && !isToggle ? 1 : 0)
          - (current === 'down' ? 1 : 0),
        userVote: isToggle ? null : type,
      };
    });

    if (current === type) {
      // Toggle off — delete the vote
      await supabase
        .from('token_votes')
        .delete()
        .eq('mint', mint)
        .eq('user_id', userId);
    } else {
      // Upsert new vote (replaces existing opposite vote)
      await supabase.from('token_votes').upsert(
        { mint, user_id: userId, vote_type: type },
        { onConflict: 'mint,user_id' }
      );
    }
  }, [mint, userId, votes?.userVote]);

  return { votes, vote };
}
