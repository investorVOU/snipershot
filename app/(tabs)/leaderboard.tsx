import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLeaderboard, LeaderboardEntry } from '../../hooks/useLeaderboard';
import { useTheme } from '../../context/ThemeContext';
import { formatSOLValue, formatPercent } from '../../utils/format';

const MEDALS = ['🥇', '🥈', '🥉'];

function EntryRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const { colors } = useTheme();
  const isProfit = entry.pnlSOL >= 0;
  const pnlColor = isProfit ? colors.green : colors.red;

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.rankBox}>
        <Text style={styles.medal}>{rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.symbol, { color: colors.text }]}>{entry.tokenSymbol}</Text>
        <Text style={[styles.name, { color: colors.textMuted }]} numberOfLines={1}>
          {entry.tokenName}
        </Text>
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {new Date(entry.closedAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.pnl}>
        <Text style={[styles.pnlPct, { color: pnlColor }]}>
          {isProfit ? '+' : ''}{formatPercent(entry.pnlPercent)}
        </Text>
        <Text style={[styles.pnlSol, { color: pnlColor }]}>
          {isProfit ? '+' : ''}{formatSOLValue(entry.pnlSOL)} SOL
        </Text>
        <Text style={[styles.invested, { color: colors.textMuted }]}>
          {formatSOLValue(entry.buySOL)} → {formatSOLValue(entry.sellSOL)}
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { entries, isLoading, totalPnlSOL, winRate, refresh } = useLeaderboard();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isProfit = totalPnlSOL >= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Summary stats */}
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total P&L</Text>
          <Text style={[styles.summaryValue, { color: isProfit ? colors.green : colors.red }]}>
            {isProfit ? '+' : ''}{formatSOLValue(totalPnlSOL)} SOL
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Win Rate</Text>
          <Text style={[styles.summaryValue, { color: winRate >= 50 ? colors.green : colors.red }]}>
            {winRate.toFixed(0)}%
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Trades</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{entries.length}</Text>
        </View>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Closed Trades Yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Complete a buy+sell cycle to appear on the leaderboard.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, i) => `${item.mint}-${i}`}
          renderItem={({ item, index }) => <EntryRow entry={item} rank={index + 1} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.accent} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  divider: { width: 1, marginVertical: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginVertical: 5,
    borderWidth: 1,
    gap: 12,
  },
  rankBox: { width: 36, alignItems: 'center' },
  medal: { fontSize: 20 },
  info: { flex: 1 },
  symbol: { fontSize: 15, fontWeight: '700' },
  name: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 11, marginTop: 1 },
  pnl: { alignItems: 'flex-end' },
  pnlPct: { fontSize: 16, fontWeight: '800' },
  pnlSol: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  invested: { fontSize: 10, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, color: '#666' },
});
