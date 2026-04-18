import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { fetchTokenByMint } from '../../services/pumpfun';
import { fetchTokenOverview, TokenOverview } from '../../services/birdeye';
import { runRugFilter, RugFilterResult } from '../../services/rugFilter';
import { getAssetMetadata } from '../../services/helius';
import { AIRatingCard } from '../../components/AIVerdictBadge';
import { PriceChart } from '../../components/PriceChart';
import { RugScoreBadge } from '../../components/RugScoreBadge';
import { SnipeSheet } from '../../components/SnipeSheet';
import { useWallet } from '../../hooks/useWallet';
import { useSniper } from '../../hooks/useSniper';
import { useAITokenRating } from '../../hooks/useAI';
import {
  formatCompact,
  formatPercent,
  formatPrice,
  formatSOLValue,
} from '../../utils/format';
import type { FeedToken } from '../../hooks/useTokenFeed';

function buildTokenContext(
  token: FeedToken,
  overview: TokenOverview | null,
  rugFilter: RugFilterResult | null
): string {
  const lines = [
    `Token: ${token.name} (${token.symbol})`,
    `Mint: ${token.mint}`,
    `Market Cap: ${overview?.marketCap ? `$${overview.marketCap.toFixed(0)}` : `$${token.usdMarketCap.toFixed(0)}`}`,
    `Price: ${overview?.price ? `$${overview.price.toExponential(4)}` : 'unknown'}`,
    `Volume 24h: ${overview?.volume24h ? `$${overview.volume24h.toFixed(0)}` : 'unknown'}`,
    `Liquidity: ${overview?.liquidity ? `$${overview.liquidity.toFixed(0)}` : 'unknown'}`,
    `Holders: ${overview?.holders ?? 'unknown'}`,
    `1h Change: ${overview?.priceChange1h != null ? `${overview.priceChange1h.toFixed(2)}%` : 'unknown'}`,
  ];
  if (rugFilter) {
    lines.push(`Rug Score: ${rugFilter.rugScore}/100`);
    lines.push(`Rug Verdict: ${rugFilter.verdict}`);
    rugFilter.breakdown.forEach((item) => {
      lines.push(`  ${item.safe ? '✓' : '✗'} ${item.label}: ${item.detail}`);
    });
  }
  if (token.description) lines.push(`Description: ${token.description}`);
  return lines.join('\n');
}

export default function TokenDetailScreen() {
  const { mint } = useLocalSearchParams<{ mint: string }>();
  const navigation = useNavigation();
  const wallet = useWallet();
  const sniper = useSniper(wallet.publicKey, wallet.signTransaction);

  const { rate: rateToken } = useAITokenRating();
  const [token, setToken] = useState<FeedToken | null>(null);
  const [overview, setOverview] = useState<TokenOverview | null>(null);
  const [rugFilter, setRugFilter] = useState<RugFilterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSnipeSheet, setShowSnipeSheet] = useState(false);
  const [isSell, setIsSell] = useState(false);

  const load = useCallback(async () => {
    if (!mint) return;
    setLoading(true);
    try {
      const [pumpToken, ov, meta] = await Promise.all([
        fetchTokenByMint(mint),
        fetchTokenOverview(mint),
        getAssetMetadata(mint),
      ]);

      const feedToken: FeedToken = {
        mint,
        name: pumpToken?.name ?? meta?.name ?? 'Unknown',
        symbol: pumpToken?.symbol ?? meta?.symbol ?? '???',
        imageUri: pumpToken?.imageUri ?? meta?.imageUri ?? '',
        description: pumpToken?.description ?? meta?.description ?? '',
        creatorAddress: pumpToken?.creatorAddress ?? meta?.creatorAddress ?? '',
        createdTimestamp: pumpToken?.createdTimestamp ?? Date.now(),
        marketCap: pumpToken?.marketCap ?? 0,
        usdMarketCap: pumpToken?.usdMarketCap ?? 0,
        solInCurve: pumpToken?.solInCurve ?? 0,
        complete: pumpToken?.complete ?? false,
        twitterUrl: pumpToken?.twitterUrl ?? meta?.twitterUrl ?? '',
        telegramUrl: pumpToken?.telegramUrl ?? meta?.telegramUrl ?? '',
        websiteUrl: pumpToken?.websiteUrl ?? meta?.externalUrl ?? '',
        totalSupply: pumpToken?.totalSupply ?? 1_000_000_000,
        rugFilter: null,
        rugFilterLoading: true,
        overview: null,
        sparklineData: [],
        isNewest: false,
        aiRating: null,
        aiRatingLoading: true,
        creatorDumped: false,
        creatorDumpPct: 0,
      };

      setToken(feedToken);
      setOverview(ov);

      navigation.setOptions({ title: `${feedToken.symbol} · ${feedToken.name}` });

      // Load rug filter
      const rf = await runRugFilter(mint, feedToken.creatorAddress);
      setRugFilter(rf);
      setToken((prev) => prev ? { ...prev, rugFilter: rf, rugFilterLoading: false } : prev);

      // Run AI rating after rug filter
      void rateToken(mint, {
        name: feedToken.name,
        symbol: feedToken.symbol,
        description: feedToken.description ?? '',
        rugScore: rf.rugScore,
        mintAuthorityRevoked: rf.mintAuthorityRevoked,
        freezeAuthorityRevoked: rf.freezeAuthorityRevoked,
        lpLocked: rf.lpLocked,
        top10HolderPercent: rf.top10HolderPercent,
        creatorSoldAll: rf.creatorSoldAll,
        solInBondingCurve: feedToken.solInCurve,
        usdMarketCap: feedToken.usdMarketCap,
        liquidity: ov?.liquidity,
        volume24h: ov?.volume24h,
        holders: ov?.holders,
        priceChange1h: ov?.priceChange1h,
      }).then((aiRating) => {
        setToken((prev) => prev ? { ...prev, aiRating: aiRating ?? null, aiRatingLoading: false } : prev);
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [mint, navigation]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      fetchTokenOverview(mint).then((ov) => {
        if (ov) setOverview(ov);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [load, mint]);

  const openLink = async (url: string) => {
    if (!url) return;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#9945ff" />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Token not found</Text>
      </View>
    );
  }

  const isPositive1h = (overview?.priceChange1h ?? 0) >= 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.tokenHeader}>
          {token.imageUri ? (
            <Image source={{ uri: token.imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{token.symbol[0] ?? '?'}</Text>
            </View>
          )}
          <View style={styles.tokenTitleBlock}>
            <Text style={styles.tokenName}>{token.name}</Text>
            <Text style={styles.tokenSymbol}>${token.symbol}</Text>
          </View>
          <RugScoreBadge rugFilter={rugFilter} loading={!rugFilter} size="medium" />
        </View>

        {/* Price chart */}
        <PriceChart mint={mint} height={220} />

        {/* Stats row */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Price</Text>
            <Text style={styles.statValue}>
              {formatPrice(overview?.price ?? 0)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>1h Change</Text>
            <Text
              style={[
                styles.statValue,
                { color: isPositive1h ? '#14f195' : '#ff4444' },
              ]}
            >
              {formatPercent(overview?.priceChange1h ?? 0)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Market Cap</Text>
            <Text style={styles.statValue}>
              ${formatCompact(overview?.marketCap ?? token.usdMarketCap)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Volume 24h</Text>
            <Text style={styles.statValue}>
              ${formatCompact(overview?.volume24h ?? 0)}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Liquidity</Text>
            <Text style={styles.statValue}>
              {overview?.liquidity ? `$${formatCompact(overview.liquidity)}` : '—'}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Holders</Text>
            <Text style={styles.statValue}>
              {formatCompact(overview?.holders ?? 0)}
            </Text>
          </View>
        </View>

        {/* Description */}
        {token.description ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <Text style={styles.description}>{token.description}</Text>
          </View>
        ) : null}

        {/* AI Rating */}
        <AIRatingCard
          aiRating={token.aiRating ?? null}
          aiRatingLoading={token.aiRatingLoading ?? false}
          creatorDumped={token.creatorDumped}
          creatorDumpPct={token.creatorDumpPct}
        />

        {/* Rug filter */}
        {rugFilter && (
          <View style={styles.card}>
            <View style={styles.rugHeader}>
              <Text style={styles.cardTitle}>Rug Analysis</Text>
              <RugScoreBadge rugFilter={rugFilter} size="medium" />
            </View>
            {rugFilter.breakdown.map((item, i) => (
              <View key={i} style={styles.rugRow}>
                <Text style={[styles.rugCheck, { color: item.safe ? '#14f195' : '#ff4444' }]}>
                  {item.safe ? '✓' : '✗'}
                </Text>
                <View style={styles.rugInfo}>
                  <Text style={styles.rugLabel}>{item.label}</Text>
                  <Text style={styles.rugDetail}>{item.detail}</Text>
                </View>
                {item.score > 0 && (
                  <View style={styles.rugScore}>
                    <Text style={styles.rugScoreText}>+{item.score}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Social links */}
        {(token.twitterUrl || token.telegramUrl || token.websiteUrl) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Links</Text>
            <View style={styles.socialLinks}>
              {token.twitterUrl ? (
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => openLink(token.twitterUrl)}
                >
                  <Text style={styles.socialBtnText}>𝕏 Twitter</Text>
                </TouchableOpacity>
              ) : null}
              {token.telegramUrl ? (
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => openLink(token.telegramUrl)}
                >
                  <Text style={styles.socialBtnText}>✈ Telegram</Text>
                </TouchableOpacity>
              ) : null}
              {token.websiteUrl ? (
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => openLink(token.websiteUrl)}
                >
                  <Text style={styles.socialBtnText}>🌐 Website</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* Bottom spacer for fixed buttons */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Fixed buy/sell/AI buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.buyBtn]}
          onPress={() => {
            setIsSell(false);
            setShowSnipeSheet(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>⚡ Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.sellBtn]}
          onPress={() => {
            setIsSell(true);
            setShowSnipeSheet(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>Sell</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.aiBtn]}
          onPress={() => {
            const ctx = buildTokenContext(token, overview, rugFilter);
            router.push({
              pathname: '/token/chat',
              params: { mint, tokenContext: ctx, tokenName: `${token.name} (${token.symbol})` },
            });
          }}
          activeOpacity={0.8}
        >
          <Feather name="cpu" size={16} color="#9945ff" />
          <Text style={styles.aiBtnText}>Ask AI</Text>
        </TouchableOpacity>
      </View>

      {/* Snipe sheet */}
      {showSnipeSheet && (
        <SnipeSheet
          token={token}
          config={sniper.config}
          onBuy={sniper.buy}
          isBuying={sniper.isBuying}
          onClose={() => setShowSnipeSheet(false)}
          connected={wallet.connected}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loading: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#555',
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: '#1e1e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#9945ff',
    fontSize: 22,
    fontWeight: '700',
  },
  tokenTitleBlock: {
    flex: 1,
  },
  tokenName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tokenSymbol: {
    color: '#9945ff',
    fontSize: 14,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  statCell: {
    backgroundColor: '#12121a',
    borderRadius: 10,
    padding: 12,
    width: '31%',
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  statLabel: {
    color: '#666',
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#12121a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  cardTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  description: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
  },
  rugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
    gap: 10,
  },
  rugCheck: {
    fontSize: 16,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  rugInfo: {
    flex: 1,
  },
  rugLabel: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  rugDetail: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  rugScore: {
    backgroundColor: '#ff444422',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rugScoreText: {
    color: '#ff4444',
    fontSize: 11,
    fontWeight: '700',
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialBtn: {
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  socialBtnText: {
    color: '#9945ff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
  },
  buyBtn: {
    backgroundColor: '#9945ff',
  },
  sellBtn: {
    backgroundColor: '#ff444422',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  aiBtn: {
    backgroundColor: '#9945ff22',
    borderWidth: 1,
    borderColor: '#9945ff66',
    flexDirection: 'row',
    gap: 6,
  },
  aiBtnText: {
    color: '#9945ff',
    fontSize: 14,
    fontWeight: '700',
  },
});
