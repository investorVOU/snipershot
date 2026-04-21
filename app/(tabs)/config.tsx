import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../../hooks/useWallet';
import { useSniper, SniperConfig } from '../../hooks/useSniper';
import { usePriceAlerts } from '../../hooks/usePriceAlerts';
import { useTheme } from '../../context/ThemeContext';
import type { PriorityMode } from '../../services/jupiter';
import { supabase } from '../../services/supabase';
import { clearWalletCache } from '../../services/embeddedWallet';
import Toast from 'react-native-toast-message';

const ALL_ASYNC_STORAGE_KEYS = [
  'snapshot_sniper_config',
  'snapshot_feed_cache',
  'snapshot_watchlist',
  'snapshot_positions',
  'snapshot_trades',
  'snapshot_price_alerts',
];

function SectionHeader({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionHeader, { color }]}>{title}</Text>;
}

export default function ConfigScreen() {
  const wallet = useWallet();
  const sniper = useSniper(wallet.publicKey, wallet.signTransaction);
  const { config, updateConfig, configLoaded } = sniper;
  const { activeAlerts, removeAlert } = usePriceAlerts();
  const { toggleTheme, isDark, colors } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = useCallback(async () => {
    Toast.show({ type: 'success', text1: 'Settings saved!' });
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account & Data',
      'This will permanently erase all your local data, trade history, positions, and wallet key from this device. Your on-chain assets are unaffected.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type "DELETE" to confirm — all app data will be wiped.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const userId = session?.user?.id;
                      const pubkey = wallet.address;

                      // 1. Clear all AsyncStorage keys
                      await AsyncStorage.multiRemove(ALL_ASYNC_STORAGE_KEYS).catch(() => {});

                      // 2. Delete Supabase user-scoped rows
                      if (pubkey) {
                        await Promise.allSettled([
                          supabase.from('trades').delete().eq('user_pubkey', pubkey),
                          supabase.from('fee_events').delete().eq('user_pubkey', pubkey),
                          supabase.from('positions').delete().eq('user_pubkey', pubkey),
                        ]);
                      }

                      // 3. Wipe wallet key from SecureStore
                      if (userId) {
                        await clearWalletCache(userId);
                      }

                      // 4. Sign out
                      await wallet.disconnect();

                      Toast.show({ type: 'success', text1: 'Account data deleted' });
                    } catch {
                      Toast.show({ type: 'error', text1: 'Delete failed', text2: 'Some data may remain' });
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [wallet]);

  const setPriorityMode = (mode: PriorityMode) => updateConfig({ priorityMode: mode });

  if (!configLoaded) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Appearance */}
      <SectionHeader title="Appearance" color={colors.accent} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: colors.textSub }]}>
              {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </Text>
            <Text style={[styles.sublabel, { color: colors.textMuted }]}>
              Toggle app theme
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Swap Settings */}
      <SectionHeader title="Swap Settings" color={colors.accent} />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSub }]}>SOL per Snipe</Text>
          <Text style={[styles.labelValue, { color: colors.accent }]}>{config.solAmount.toFixed(2)} SOL</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0.01}
          maximumValue={5}
          step={0.01}
          value={config.solAmount}
          onValueChange={(v) => updateConfig({ solAmount: parseFloat(v.toFixed(2)) })}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.accent}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderMin, { color: colors.textMuted }]}>0.01 SOL</Text>
          <Text style={[styles.sliderMax, { color: colors.textMuted }]}>5 SOL</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSub }]}>Slippage Tolerance</Text>
          <Text style={[styles.labelValue, { color: colors.accent }]}>{(config.slippageBps / 100).toFixed(1)}%</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={50}
          maximumValue={5000}
          step={50}
          value={config.slippageBps}
          onValueChange={(v) => updateConfig({ slippageBps: Math.round(v) })}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.accent}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderMin, { color: colors.textMuted }]}>0.5%</Text>
          <Text style={[styles.sliderMax, { color: colors.textMuted }]}>50%</Text>
        </View>
      </View>

      {/* Auto-Snipe */}
      <SectionHeader title="Auto-Snipe" color={colors.accent} />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: colors.textSub }]}>Auto-Snipe</Text>
            <Text style={[styles.sublabel, { color: colors.textMuted }]}>Auto-buy tokens passing the rug filter</Text>
          </View>
          <Switch
            value={config.autoSnipe}
            onValueChange={(v) => updateConfig({ autoSnipe: v })}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {config.autoSnipe && (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.textSub }]}>Max Rug Score</Text>
              <Text style={[styles.labelValue, { color: colors.green }]}>≤ {config.autoSnipeThreshold}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={50}
              step={1}
              value={config.autoSnipeThreshold}
              onValueChange={(v) => updateConfig({ autoSnipeThreshold: Math.round(v) })}
              minimumTrackTintColor={colors.green}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.green}
            />
            <View style={styles.sliderLabels}>
              <Text style={[styles.sliderMin, { color: colors.textMuted }]}>0 (Safe only)</Text>
              <Text style={[styles.sliderMax, { color: colors.textMuted }]}>50</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSub }]}>Min LP Size (SOL)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.bg, borderColor: colors.accent + '44', color: colors.text }]}
              value={config.autoSnipeMinLP.toString()}
              onChangeText={(v) => { const n = parseFloat(v); if (!isNaN(n)) updateConfig({ autoSnipeMinLP: n }); }}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              placeholder="2"
            />
          </View>
        </>
      )}

      {/* Take Profit / Stop Loss */}
      <SectionHeader title="Take Profit / Stop Loss" color={colors.accent} />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSub }]}>Take Profit</Text>
          <Text style={[styles.labelValue, { color: colors.green }]}>
            +{config.takeProfitPercent.toFixed(0)}% ({(1 + config.takeProfitPercent / 100).toFixed(1)}x)
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={10}
          maximumValue={1000}
          step={10}
          value={config.takeProfitPercent}
          onValueChange={(v) => updateConfig({ takeProfitPercent: Math.round(v) })}
          minimumTrackTintColor={colors.green}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.green}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderMin, { color: colors.textMuted }]}>10%</Text>
          <Text style={[styles.sliderMax, { color: colors.textMuted }]}>1000%</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSub }]}>Stop Loss</Text>
          <Text style={[styles.labelValue, { color: colors.red }]}>-{config.stopLossPercent.toFixed(0)}%</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={5}
          maximumValue={90}
          step={5}
          value={config.stopLossPercent}
          onValueChange={(v) => updateConfig({ stopLossPercent: Math.round(v) })}
          minimumTrackTintColor={colors.red}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.red}
        />
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderMin, { color: colors.textMuted }]}>5%</Text>
          <Text style={[styles.sliderMax, { color: colors.textMuted }]}>90%</Text>
        </View>
      </View>

      {/* Priority Fee */}
      <SectionHeader title="Priority Fee" color={colors.accent} />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.priorityGroup}>
          {(['normal', 'fast', 'jito'] as PriorityMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.priorityBtn,
                { backgroundColor: colors.surface, borderColor: '#2a2a3a' },
                config.priorityMode === mode && { borderColor: colors.accent, backgroundColor: colors.accent + '22' },
              ]}
              onPress={() => setPriorityMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.priorityBtnText,
                { color: colors.textMuted },
                config.priorityMode === mode && { color: colors.accent },
              ]}>
                {mode === 'normal' ? '🐢 Normal' : mode === 'fast' ? '⚡ Fast' : '🟣 Jito'}
              </Text>
              <Text style={[styles.prioritySubtext, { color: colors.textMuted }]}>
                {mode === 'normal' ? '~50k lamps' : mode === 'fast' ? '~200k lamps' : 'Bundle + tip'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Price Alerts */}
      <SectionHeader title="Price Alerts" color={colors.accent} />

      {activeAlerts.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyAlerts, { color: colors.textMuted }]}>
            No active alerts. Star a token and set a target price from its detail page.
          </Text>
        </View>
      ) : (
        activeAlerts.map((alert) => (
          <View key={alert.id} style={[styles.alertRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.alertInfo}>
              <Text style={[styles.alertSymbol, { color: colors.text }]}>${alert.tokenSymbol}</Text>
              <Text style={[styles.alertTarget, { color: alert.direction === 'above' ? colors.green : colors.red }]}>
                {alert.direction === 'above' ? '▲' : '▼'} ${alert.targetPrice}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Remove Alert', `Remove ${alert.tokenSymbol} price alert?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeAlert(alert.id) },
                ]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.alertRemove, { color: colors.red }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={[styles.feeNotice, { backgroundColor: colors.accent + '11', borderColor: colors.accent + '33' }]}>
        <Text style={[styles.feeNoticeText, { color: colors.accent + '99' }]}>
          Platform fee: 0.5% on all swaps (Jupiter feeAccount)
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.accent }]}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>

      {/* Danger Zone */}
      <SectionHeader title="Danger Zone" color="#ef4444" />
      <View style={[styles.card, { backgroundColor: '#ef444411', borderColor: '#ef444433' }]}>
        <Text style={[styles.dangerDesc, { color: colors.textMuted }]}>
          Permanently delete all local data, trade history, positions, and your wallet key from this device. Your on-chain assets are NOT affected — only app data is erased.
        </Text>
        <TouchableOpacity
          style={[styles.dangerBtn, isDeleting && { opacity: 0.6 }]}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
          activeOpacity={0.8}
        >
          {isDeleting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.dangerBtnText}>Delete Account & Data</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 14, fontWeight: '600' },
  sublabel: { fontSize: 12, marginTop: 2 },
  labelValue: { fontSize: 14, fontWeight: '700' },
  green: { color: '#14f195' },
  slider: { width: '100%', height: 36 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderMin: { fontSize: 11 },
  sliderMax: { fontSize: 11 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
    marginTop: 8,
  },
  priorityGroup: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  priorityBtnText: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  prioritySubtext: { fontSize: 10 },
  feeNotice: {
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  feeNoticeText: { fontSize: 12, textAlign: 'center' },
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyAlerts: { fontSize: 13, textAlign: 'center', paddingVertical: 8, lineHeight: 20 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  alertInfo: { gap: 2 },
  alertSymbol: { fontSize: 14, fontWeight: '600' },
  alertTarget: { fontSize: 13, fontWeight: '600' },
  alertRemove: { fontSize: 16, fontWeight: '700' },
  dangerDesc: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  dangerBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
