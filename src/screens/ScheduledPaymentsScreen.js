/**
 * ScheduledPaymentsScreen.js
 * Shows all scheduled payments with filter tabs, calendar dots,
 * and per-item actions: run now, pause/resume, edit, cancel.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, FlatList, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useWallet, RECURRENCE, PAY_METHOD, formatRelativeDate } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

// ── helpers ────────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = d => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${MONTHS[+m-1]} ${+day}, ${y}`;
};

const STATUS_CONFIG = {
  upcoming:   { label: 'Upcoming',   bg: '#EEF2FF', text: '#4F46E5', dot: '#4F46E5'  },
  paused:     { label: 'Paused',     bg: '#FEF9C3', text: '#854D0E', dot: '#EAB308'  },
  completed:  { label: 'Done',       bg: '#DCFCE7', text: '#166534', dot: '#16A34A'  },
  failed:     { label: 'Failed',     bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444'  },
  cancelled:  { label: 'Cancelled',  bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8'  },
  processing: { label: 'Processing', bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B'  },
};

const MAIN_TABS = [
  { key: 'active',    label: 'Active',            icon: 'play-circle-outline',  statuses: ['upcoming','processing']     },
  { key: 'paused',    label: 'Paused/Cancelled',  icon: 'pause-circle-outline', statuses: ['paused','cancelled','failed'] },
  { key: 'completed', label: 'Completed',          icon: 'checkmark-circle-outline', statuses: ['completed']             },
];

// ── Month list (6 months back → 6 months forward) ────────────────────────────
const buildMonths = () => {
  const arr = [];
  const now = new Date();
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    arr.push({
      key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleString('default', { month: 'short' }),
      year:  d.getFullYear(),
      isNow: i === 0,
    });
  }
  return arr;
};
const MONTH_LIST = buildMonths();
const CURRENT_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

// ═════════════════════════════════════════════════════════════════════════════
export default function ScheduledPaymentsScreen({ navigation }) {
  const {
    scheduledPayments, pockets,
    pauseSchedule, resumeSchedule, cancelSchedule, runScheduleNow,
  } = useWallet();

  const [activeFilter,   setActiveFilter]   = useState('active');
  const [selectedMonth,  setSelectedMonth]  = useState(CURRENT_MONTH);
  const [refreshing,     setRefreshing]     = useState(false);
  const [expandedId,     setExpandedId]     = useState(null);
  const monthScrollRef = useRef(null);

  // Auto-scroll month strip to current month on mount
  useEffect(() => {
    const currentIndex = MONTH_LIST.findIndex(m => m.key === CURRENT_MONTH);
    if (monthScrollRef.current && currentIndex > 0) {
      // Each chip is ~72px wide + 8px gap; scroll so current month is near centre
      setTimeout(() => {
        monthScrollRef.current?.scrollTo({ x: Math.max(0, (currentIndex - 2) * 80), animated: false });
      }, 100);
    }
  }, []);

  // Count per month for dot indicators
  const countByMonth = useMemo(() => {
    const map = {};
    scheduledPayments.forEach(s => {
      const m = (s.nextRunDate || s.scheduledDate || '').slice(0, 7);
      if (m) map[m] = (map[m] || 0) + 1;
    });
    return map;
  }, [scheduledPayments]);

  // Filtered list
  const filtered = useMemo(() => {
    const tab = MAIN_TABS.find(t => t.key === activeFilter);
    let list = tab ? scheduledPayments.filter(s => tab.statuses.includes(s.status)) : scheduledPayments;
    // Month filter
    list = list.filter(s => {
      const dateStr = s.nextRunDate || s.scheduledDate || '';
      return dateStr.slice(0, 7) === selectedMonth;
    });
    return [...list].sort((a, b) => {
      const order = { upcoming: 0, processing: 1, paused: 2, failed: 3, completed: 4, cancelled: 5 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (a.nextRunDate || '').localeCompare(b.nextRunDate || '');
    });
  }, [scheduledPayments, activeFilter, selectedMonth]);

  // Stats
  const stats = useMemo(() => {
    const upcoming    = scheduledPayments.filter(s => s.status === 'upcoming');
    const inMonth     = upcoming.filter(s => (s.nextRunDate || '').slice(0, 7) === selectedMonth);
    const totalAmt    = inMonth.reduce((acc, s) => acc + s.amount, 0);
    const dueToday    = upcoming.filter(s => s.nextRunDate === TODAY).length;
    return { count: inMonth.length, totalAmt, dueToday };
  }, [scheduledPayments, selectedMonth]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const confirmCancel = (sched) => {
    Alert.alert(
      'Cancel Schedule',
      `Are you sure you want to cancel "${sched.label}"? This cannot be undone.`,
      [
        { text: 'Keep It', style: 'cancel' },
        { text: 'Cancel Schedule', style: 'destructive', onPress: () => cancelSchedule(sched.id) },
      ]
    );
  };

  const confirmRunNow = (sched) => {
    Alert.alert(
      'Run Now',
      `Execute "${sched.label}" immediately?\n₹${sched.amount.toLocaleString('en-IN')} will be deducted from ${sched.pocketName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run Now', onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          runScheduleNow(sched.id);
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── Header ── */}
        <LinearGradient colors={['#7C3AED','#4F46E5']} style={s.header} start={{x:0,y:0}} end={{x:1,y:1}}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.headerTitle}>Scheduled Payments</Text>
              <Text style={s.headerSub}>{stats.count} active · ₹{stats.totalAmt.toLocaleString('en-IN')} pending</Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('SchedulePayment', {})}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            <StatChip icon="today-outline"    label="Due Today"  value={stats.dueToday} />
            <StatChip icon="calendar-outline" label="This Month" value={stats.count} />
            <StatChip icon="cash-outline"     label="Pending"    value={`₹${(stats.totalAmt/1000).toFixed(0)}k`} />
          </View>
        </LinearGradient>

        {/* ── Month filter ── */}
        <View style={s.monthWrap}>
          <ScrollView ref={monthScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.monthRow}>
            {MONTH_LIST.map(m => {
              const isSelected = m.key === selectedMonth;
              const hasSched   = !!countByMonth[m.key];
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[s.monthChip, isSelected && s.monthChipActive]}
                  onPress={() => setSelectedMonth(m.key)}
                >
                  <Text style={[s.monthLabel, isSelected && s.monthLabelActive]}>{m.label}</Text>
                  <Text style={[s.monthYear, isSelected && { color: 'rgba(255,255,255,0.75)' }]}>{m.year}</Text>
                  {hasSched && <View style={[s.monthDot, isSelected && { backgroundColor: '#fff' }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Main tabs ── */}
        <View style={s.tabBar}>
          {MAIN_TABS.map(tab => {
            const count = scheduledPayments.filter(s => tab.statuses.includes(s.status)).length;
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabItem, isActive && s.tabItemActive]}
                onPress={() => setActiveFilter(tab.key)}
              >
                <Ionicons name={tab.icon} size={16} color={isActive ? COLORS.primary : COLORS.textSecondary} />
                <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{tab.label}</Text>
                {count > 0 && (
                  <View style={[s.tabCount, isActive && s.tabCountActive]}>
                    <Text style={[s.tabCountTxt, isActive && { color: COLORS.primary }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Schedule list ── */}
        <View style={s.listWrap}>
          {filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="calendar-outline" size={52} color={COLORS.textLight} />
              <Text style={s.emptyTitle}>No {MAIN_TABS.find(t => t.key === activeFilter)?.label || ''} schedules</Text>
              <Text style={s.emptySub}>Tap + to create a scheduled payment</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('SchedulePayment', {})}>
                <Text style={s.emptyBtnTxt}>Create Schedule</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map(sched => (
              <ScheduleCard
                key={sched.id}
                sched={sched}
                expanded={expandedId === sched.id}
                onToggle={() => setExpandedId(expandedId === sched.id ? null : sched.id)}
                onEdit={() => navigation.navigate('SchedulePayment', { scheduleId: sched.id })}
                onPause={() => pauseSchedule(sched.id)}
                onResume={() => resumeSchedule(sched.id)}
                onCancel={() => confirmCancel(sched)}
                onRunNow={() => confirmRunNow(sched)}
              />
            ))
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('SchedulePayment', {})}>
        <LinearGradient colors={['#7C3AED','#4F46E5']} style={s.fabGrad}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ── Schedule card component ────────────────────────────────────────────────────
function ScheduleCard({ sched, expanded, onToggle, onEdit, onPause, onResume, onCancel, onRunNow }) {
  const st  = STATUS_CONFIG[sched.status] || STATUS_CONFIG.upcoming;
  const pm  = PAY_METHOD[sched.paymentType] || { label: sched.paymentType, icon: 'send-outline' };
  const rec = RECURRENCE[sched.recurrence]  || { label: sched.recurrence };
  const isActive = sched.status === 'upcoming' || sched.status === 'paused';

  return (
    <TouchableOpacity style={s.card} onPress={onToggle} activeOpacity={0.85}>
      {/* Top row */}
      <View style={s.cardTop}>
        {/* Icon */}
        <View style={[s.cardIcon, { backgroundColor: COLORS.primary + '18' }]}>
          <Ionicons name={pm.icon} size={20} color={COLORS.primary} />
        </View>

        {/* Info */}
        <View style={s.cardInfo}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardLabel} numberOfLines={1}>{sched.label}</Text>
            <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
              <View style={[s.statusDot, { backgroundColor: st.dot }]} />
              <Text style={[s.statusTxt, { color: st.text }]}>{st.label}</Text>
            </View>
          </View>
          <View style={s.cardMeta}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
            <Text style={s.cardMetaTxt}>{formatRelativeDate(sched.nextRunDate)}  ·  {sched.scheduledTime}</Text>
            <View style={s.recPill}>
              <Text style={s.recPillTxt}>{rec.label}</Text>
            </View>
          </View>
        </View>

        {/* Amount */}
        <Text style={s.cardAmt}>₹{sched.amount.toLocaleString('en-IN')}</Text>
      </View>

      {/* Pocket badge */}
      <View style={s.cardPocketRow}>
        <Ionicons name="layers-outline" size={12} color={COLORS.textSecondary} />
        <Text style={s.cardPocketTxt}>
          {sched.pocketName}
          {sched.paymentType === 'pocket' && sched.toPocketName ? ` → ${sched.toPocketName}` : ''}
          {sched.recipient ? ` → ${sched.recipient}` : ''}
        </Text>
        <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={COLORS.textSecondary} />
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={s.cardExpanded}>
          <View style={s.detailGrid}>
            <Detail label="Amount"    value={`₹${sched.amount.toLocaleString('en-IN')}`} />
            <Detail label="Recurrence" value={rec.label} />
            <Detail label="Next Run"  value={fmtDate(sched.nextRunDate)} />
            <Detail label="Time"      value={sched.scheduledTime || '—'} />
            <Detail label="Method"    value={pm.label} />
            <Detail label="Runs Done" value={String(sched.execCount || 0)} />
            {sched.endDate && <Detail label="Ends"   value={fmtDate(sched.endDate)} />}
            {sched.note    && <Detail label="Note"   value={sched.note} full />}
          </View>

          {/* Action buttons */}
          {isActive && (
            <View style={s.actionRow}>
              <ActionBtn icon="play-outline"        label="Run Now"  color={COLORS.success} onPress={onRunNow} />
              {sched.status === 'upcoming'
                ? <ActionBtn icon="pause-outline"   label="Pause"    color={COLORS.warning} onPress={onPause} />
                : <ActionBtn icon="play-circle-outline" label="Resume" color={COLORS.primary} onPress={onResume} />
              }
              <ActionBtn icon="create-outline"      label="Edit"     color={COLORS.info}    onPress={onEdit} />
              <ActionBtn icon="trash-outline"       label="Cancel"   color={COLORS.danger}  onPress={onCancel} />
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────
const StatChip = ({ icon, label, value }) => (
  <View style={s.statChip}>
    <Ionicons name={icon} size={14} color="rgba(255,255,255,0.8)" />
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const Detail = ({ label, value, full }) => (
  <View style={[s.detailItem, full && { width: '100%' }]}>
    <Text style={s.detailLabel}>{label}</Text>
    <Text style={s.detailVal} numberOfLines={2}>{value}</Text>
  </View>
);

const ActionBtn = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={s.actionBtn} onPress={onPress}>
    <View style={[s.actionBtnIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[s.actionBtnTxt, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  header:           { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 20 },
  headerTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle:      { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub:        { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  statsRow:         { flexDirection: 'row', gap: 10 },
  statChip:         { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statValue:        { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel:        { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  // Month filter
  monthWrap:        { backgroundColor: COLORS.white, paddingVertical: 10, ...SHADOWS.sm },
  monthRow:         { paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center' },
  monthChip:        { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#F1F5F9', gap: 2 },
  monthChipActive:  { backgroundColor: COLORS.primary },
  monthLabel:       { fontSize: 13, fontWeight: '700', color: COLORS.text },
  monthLabelActive: { color: '#fff' },
  monthYear:        { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  monthDot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
  // Tabs
  tabBar:           { flexDirection: 'row', marginHorizontal: SPACING.md, marginVertical: 12, backgroundColor: COLORS.white, borderRadius: 16, padding: 4, ...SHADOWS.sm },
  tabItem:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12 },
  tabItemActive:    { backgroundColor: COLORS.primaryLight },
  tabLabel:         { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabLabelActive:   { color: COLORS.primary, fontWeight: '700' },
  tabCount:         { backgroundColor: '#F1F5F9', borderRadius: 9, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  tabCountActive:   { backgroundColor: COLORS.primary + '22' },
  tabCountTxt:      { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  // List
  listWrap:         { paddingHorizontal: SPACING.md, paddingTop: 4 },
  card:             { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOWS.sm },
  cardTop:          { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  cardIcon:         { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cardInfo:         { flex: 1 },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardLabel:        { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusDot:        { width: 5, height: 5, borderRadius: 3 },
  statusTxt:        { fontSize: 11, fontWeight: '700' },
  cardMeta:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaTxt:      { fontSize: 12, color: COLORS.textSecondary },
  recPill:          { backgroundColor: '#EDE9FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  recPillTxt:       { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  cardAmt:          { fontSize: 17, fontWeight: '800', color: COLORS.text },
  cardPocketRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  cardPocketTxt:    { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  // Expanded
  cardExpanded:     { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 12, paddingTop: 12 },
  detailGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  detailItem:       { width: '46%' },
  detailLabel:      { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  detailVal:        { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actionRow:        { flexDirection: 'row', gap: 8 },
  actionBtn:        { flex: 1, alignItems: 'center', gap: 4 },
  actionBtnIcon:    { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnTxt:     { fontSize: 11, fontWeight: '700' },
  // Empty
  emptyWrap:        { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptySub:         { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  emptyBtn:         { backgroundColor: COLORS.primaryLight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  emptyBtnTxt:      { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  // FAB
  fab:              { position: 'absolute', bottom: 24, right: 20, borderRadius: 28, overflow: 'hidden', ...SHADOWS.lg },
  fabGrad:          { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
