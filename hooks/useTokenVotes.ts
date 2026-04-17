export function useTokenVotes(_mint: string) {
  return {
    votes: null as { upvotes: number; downvotes: number; userVote: "up" | "down" | null } | null,
    vote: async (_type: "up" | "down") => {},
  };
}
