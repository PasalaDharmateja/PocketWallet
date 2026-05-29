import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - SPACING.md * 2 - 40;

const MONTHS = ['2026-02','2026-01','2025-12','2025-11'];
const MONTH_LABELS = { '2026-02':'Feb 2026','2026-01':'Jan 2026','2025-12':'Dec 2025','2025-11':'Nov 2025' };

export default function ReportScreen() {
  const { pockets } = useWallet();
  const [reportMonth, setReportMonth] = useState('2026-02');

  const data = useMemo(() => {
    const allTx = pockets.flatMap(p => p.transactions.map(t => ({ ...t, pocketId: p.id, pocketName: p.name, pocketColor: p.color })));
    const monthTx = allTx.filter(t => t.date.startsWith(reportMonth));
    const totalCredit = monthTx.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalDebit  = monthTx.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const pocketStats = pockets.map(p => {
      const ptx = monthTx.filter(t => t.pocketId === p.id);
      const spent    = ptx.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      const received = ptx.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      return { ...p, spent, received, txCount: ptx.length, transactions: ptx };
    }).filter(p => p.txCount > 0);
    const daysInMonth = reportMonth === '2026-02' ? 28 : 31;
    const dailySpend = Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const dateStr = `${reportMonth}-${day}`;
      const amt = monthTx.filter(t => t.date === dateStr && t.type === 'debit').reduce((s, t) => s + t.amount, 0);
      return { day: i + 1, amount: amt };
    });
    return { totalCredit, totalDebit, pocketStats, dailySpend, allTx: monthTx };
  }, [pockets, reportMonth]);

  const maxBar = Math.max(...data.dailySpend.map(d => d.amount), 1);
  const totalSpend = data.pocketStats.reduce((s, p) => s + p.spent, 0);
  const monthIdx = MONTHS.indexOf(reportMonth);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity style={styles.monthArrow} onPress={() => monthIdx < MONTHS.length-1 && setReportMonth(MONTHS[monthIdx+1])} disabled={monthIdx === MONTHS.length-1}>
            <Ionicons name="chevron-back" size={20} color={monthIdx === MONTHS.length-1 ? COLORS.textLight : COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_LABELS[reportMonth]}</Text>
          <TouchableOpacity style={styles.monthArrow} onPress={() => monthIdx > 0 && setReportMonth(MONTHS[monthIdx-1])} disabled={monthIdx === 0}>
            <Ionicons name="chevron-forward" size={20} color={monthIdx === 0 ? COLORS.textLight : COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <SummaryCard icon="arrow-down-circle-outline" label="Received" amount={data.totalCredit} color={COLORS.success} bg="#DCFCE7" />
          <SummaryCard icon="arrow-up-circle-outline" label="Spent" amount={data.totalDebit} color={COLORS.danger} bg="#FEE2E2" />
          <SummaryCard icon="receipt-outline" label="Transactions" amount={data.allTx.length} color={COLORS.primary} bg="#EEF2FF" isCount />
        </View>

        {/* Net Balance */}
        <LinearGradient
          colors={data.totalCredit - data.totalDebit >= 0 ? ['#059669','#10B981'] : ['#DC2626','#EF4444']}
          style={styles.netCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <Text style={styles.netLabel}>Net this month</Text>
          <Text style={styles.netAmt}>
            {data.totalCredit - data.totalDebit >= 0 ? '+' : ''}₹{Math.abs(data.totalCredit - data.totalDebit).toLocaleString('en-IN')}
          </Text>
          <Ionicons name={data.totalCredit - data.totalDebit >= 0 ? 'trending-up-outline' : 'trending-down-outline'} size={28} color="rgba(255,255,255,0.6)" />
        </LinearGradient>

        {/* Bar Chart */}
        {data.dailySpend.some(d => d.amount > 0) && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Daily Spending</Text>
            <Text style={styles.chartSub}>{MONTH_LABELS[reportMonth]}</Text>
            <View style={styles.barChart}>
              {data.dailySpend.map((d, i) => {
                const h = maxBar > 0 ? Math.max((d.amount / maxBar) * 80, d.amount > 0 ? 4 : 0) : 0;
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { height: h, backgroundColor: d.amount > 0 ? COLORS.primary : '#E2E8F0' }]} />
                    </View>
                    {d.day % 7 === 1 && <Text style={styles.barLabel}>{d.day}</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Pocket Breakdown */}
        <Text style={styles.sectionTitle}>Pocket Breakdown</Text>
        {data.pocketStats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={40} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No activity this month</Text>
          </View>
        ) : (
          data.pocketStats.map(pocket => {
            const share = totalSpend > 0 ? (pocket.spent / totalSpend) * 100 : 0;
            return (
              <View key={pocket.id} style={styles.pocketReport}>
                <View style={styles.pocketReportHeader}>
                  <View style={[styles.pocketDot, { backgroundColor: pocket.color }]} />
                  <View style={styles.pocketReportInfo}>
                    <Text style={styles.pocketReportName}>{pocket.name}</Text>
                    <Text style={styles.pocketReportCount}>{pocket.txCount} transaction{pocket.txCount !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.pocketReportAmts}>
                    {pocket.spent > 0 && <Text style={styles.spentAmt}>-₹{pocket.spent.toLocaleString('en-IN')}</Text>}
                    {pocket.received > 0 && <Text style={styles.rcvdAmt}>+₹{pocket.received.toLocaleString('en-IN')}</Text>}
                  </View>
                </View>
                {pocket.spent > 0 && (
                  <View style={styles.shareRow}>
                    <View style={styles.shareBg}>
                      <View style={[styles.shareFill, { width: `${share}%`, backgroundColor: pocket.color }]} />
                    </View>
                    <Text style={styles.sharePct}>{share.toFixed(1)}%</Text>
                  </View>
                )}
                {pocket.transactions.map(tx => (
                  <View key={tx.id} style={styles.miniTx}>
                    <View style={[styles.miniTxDot, { backgroundColor: tx.type === 'credit' ? '#DCFCE7' : '#FEE2E2' }]}>
                      <Ionicons name={tx.type === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'} size={12} color={tx.type === 'credit' ? COLORS.success : COLORS.danger} />
                    </View>
                    <Text style={styles.miniTxDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={[styles.miniTxAmt, { color: tx.type === 'credit' ? COLORS.success : COLORS.danger }]}>
                      {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SummaryCard = ({ icon, label, amount, color, bg, isCount }) => (
  <View style={[styles.summaryCard, { backgroundColor: bg }]}>
    <Ionicons name={icon} size={22} color={color} />
    <Text style={[styles.summaryAmt, { color }]}>{isCount ? amount : `₹${amount.toLocaleString('en-IN')}`}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 40 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 8, marginBottom: 16, ...SHADOWS.sm },
  monthArrow: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  monthLabel: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', gap: 4, ...SHADOWS.sm },
  summaryAmt: { fontSize: 16, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  netCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: RADIUS.lg, padding: 18, marginBottom: 16, ...SHADOWS.md },
  netLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  netAmt: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  chartCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 18, marginBottom: 20, ...SHADOWS.sm },
  chartTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  chartSub: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', height: 100, justifyContent: 'flex-end' },
  barBg: { width: '100%', height: 80, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 2, minHeight: 3 },
  barLabel: { fontSize: 9, color: COLORS.textLight, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyState: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 32, alignItems: 'center', gap: 8, ...SHADOWS.sm },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
  pocketReport: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 10, ...SHADOWS.sm },
  pocketReportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  pocketDot: { width: 42, height: 42, borderRadius: 13 },
  pocketReportInfo: { flex: 1 },
  pocketReportName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  pocketReportCount: { fontSize: 12, color: COLORS.textSecondary },
  pocketReportAmts: { alignItems: 'flex-end' },
  spentAmt: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  rcvdAmt: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  shareBg: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  shareFill: { height: 6, borderRadius: 3 },
  sharePct: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, width: 36, textAlign: 'right' },
  miniTx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  miniTxDot: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  miniTxDesc: { flex: 1, fontSize: 12, color: COLORS.text },
  miniTxAmt: { fontSize: 12, fontWeight: '700' },
});
