import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet, PRIORITY_CONFIG } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

export default function PocketCard({ pocket, totalBalance, onPress }) {
  const { updatePocketPriority, deletePocket, scheduledPayments } = useWallet();
  const curMonth = new Date().toISOString().slice(0, 7);
  const hasLowBalance = scheduledPayments.some(
    s => s.pocketId === pocket.id &&
         (s.status === 'upcoming' || s.status === 'paused') &&
         (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === curMonth &&
         pocket.balance < s.amount,
  );
  const pc = PRIORITY_CONFIG[pocket.priority];
  const pct = totalBalance > 0 ? Math.min((pocket.balance / totalBalance) * 100, 100) : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Color accent */}
      <View style={[styles.accent, { backgroundColor: pocket.color }]} />

      <View style={styles.body}>
        {/* Top Row */}
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <View style={[styles.colorDot, { backgroundColor: pocket.color }]} />
            <Text style={styles.name} numberOfLines={1}>{pocket.name}</Text>
            {hasLowBalance && (
              <View style={styles.alertBadge}>
                <Ionicons name="warning" size={11} color="#92400E" />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.priorityChip, { backgroundColor: pc.bg, borderColor: pc.border }]}
            onPress={(e) => {
              e.stopPropagation();
              const cycle = { high: 'medium', medium: 'low', low: 'high' };
              updatePocketPriority(pocket.id, cycle[pocket.priority]);
            }}
          >
            <Text style={[styles.priorityText, { color: pc.text }]}>{pc.stars} {pc.label}</Text>
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <Text style={styles.balance}>₹{pocket.balance.toLocaleString('en-IN')}</Text>

        {/* Progress Bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pocket.color }]} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.txCount}>{pocket.transactions.length} transactions</Text>
          <View style={styles.footerRight}>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden', ...SHADOWS.md,
  },
  accent: { width: 5 },
  body: { flex: 1, padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  alertBadge: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  priorityChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  priorityText: { fontSize: 10, fontWeight: '600' },
  balance: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 10, letterSpacing: -0.5 },
  progressBg: { height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txCount: { fontSize: 12, color: COLORS.textLight },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewDetails: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
});
