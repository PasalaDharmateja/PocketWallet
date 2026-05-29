import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet, PRIORITY_CONFIG, RECURRENCE, SCHED_STATUS } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

export default function PocketDetailScreen({ route, navigation }) {
  const { pocketId } = route.params;
  const {
    pockets, walletBalance, allocateToPocket, withdrawFromPocket,
    renamePocket, deletePocket, updatePocketPriority,
    scheduledPayments, cancelSchedule, pauseSchedule, resumeSchedule, runScheduleNow,
  } = useWallet();
  const pocket = pockets.find(p => p.id === pocketId);

  const [showManage, setShowManage] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showLowBalAlert, setShowLowBalAlert] = useState(false);
  const [schedTab, setSchedTab] = useState('active');
  const [selectedSchedMonth, setSelectedSchedMonth] = useState('');
  const schedMonthScrollRef = useRef(null);
  const [manageAmount, setManageAmount] = useState('');
  const [newName, setNewName] = useState(pocket?.name || '');
  const [newPriority, setNewPriority] = useState(pocket?.priority || 'medium');

  // Build month list once (6 months back → 6 months forward)
  const curMonth = new Date().toISOString().slice(0, 7);
  const SCHED_MONTH_LIST = (() => {
    const list = [];
    const now = new Date();
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      list.push({ key, label, year });
    }
    return list;
  })();
  const activeSchedMonth = selectedSchedMonth || curMonth;

  // Auto-scroll month bar to active month when modal opens
  useEffect(() => {
    if (showSchedules) {
      const idx = SCHED_MONTH_LIST.findIndex(m => m.key === activeSchedMonth);
      if (idx >= 0) {
        setTimeout(() => {
          schedMonthScrollRef.current?.scrollTo({ x: Math.max(0, (idx - 2) * 80), animated: false });
        }, 150);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSchedules]);

  if (!pocket) { navigation.goBack(); return null; }

  const pocketSchedules = scheduledPayments.filter(s => s.pocketId === pocketId);
  const curMonthSchedules = pocketSchedules.filter(
    s => (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === curMonth,
  );

  const SCHED_STATUS_META = {
    upcoming:   { color: '#3B82F6', bg: '#EFF6FF', label: 'Upcoming' },
    processing: { color: '#F59E0B', bg: '#FFFBEB', label: 'Processing' },
    completed:  { color: '#10B981', bg: '#ECFDF5', label: 'Completed' },
    failed:     { color: '#EF4444', bg: '#FEF2F2', label: 'Failed' },
    paused:     { color: '#6B7280', bg: '#F3F4F6', label: 'Paused' },
    cancelled:  { color: '#9CA3AF', bg: '#F9FAFB', label: 'Cancelled' },
  };

  const PAYMENT_OPTIONS = [
    { id: 'upi-qr',    icon: 'qr-code-outline',      label: 'Scan QR',          gradient: ['#7C3AED','#EC4899'] },
    { id: 'upi-phone', icon: 'call-outline',          label: 'UPI Phone No.',    gradient: ['#2563EB','#06B6D4'] },
    { id: 'upi-id',    icon: 'at-circle-outline',     label: 'UPI ID',           gradient: ['#4F46E5','#7C3AED'] },
    { id: 'bank',      icon: 'business-outline',      label: 'Bank Transfer',    gradient: ['#059669','#10B981'] },
    { id: 'razorpay',  icon: 'card-outline',          label: 'Razorpay',         gradient: ['#0EA5E9','#4F46E5'] },
  ];

  const handleAllocate = (direction) => {
    const amount = parseFloat(manageAmount);
    if (!amount || amount <= 0) { Alert.alert('Enter a valid amount'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ok = direction === 'add'
      ? allocateToPocket(pocketId, amount)
      : withdrawFromPocket(pocketId, amount);
    if (!ok) Alert.alert('Insufficient funds', direction === 'add' ? 'Not enough in wallet.' : 'Not enough in pocket.');
    else { setManageAmount(''); setShowManage(false); }
  };

  const handleDelete = () => {
    Alert.alert('Delete Pocket', `Delete "${pocket.name}"? ${pocket.balance > 0 ? `₹${pocket.balance.toLocaleString('en-IN')} will return to wallet.` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deletePocket(pocketId); navigation.goBack(); } },
    ]);
  };

  const handleRename = () => {
    if (!newName.trim()) { Alert.alert('Enter a name'); return; }
    renamePocket(pocketId, newName.trim());
    if (newPriority !== pocket.priority) updatePocketPriority(pocketId, newPriority);
    setShowRename(false);
  };

  const txCredits = pocket.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const txDebits  = pocket.transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero Card */}
        <LinearGradient colors={[pocket.color, pocket.color + 'BB']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="layers-outline" size={28} color={COLORS.white} />
            </View>
            <View style={styles.heroActions}>
              <TouchableOpacity onPress={() => { setNewName(pocket.name); setNewPriority(pocket.priority || 'medium'); setShowRename(true); }} style={styles.heroActionBtn}>
                <Ionicons name="pencil-outline" size={18} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.heroActionBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>{pocket.name}</Text>
            {curMonthSchedules.some(s => (s.status === 'upcoming' || s.status === 'paused') && pocket.balance < s.amount) && (
              <TouchableOpacity style={styles.heroAlertBadge} onPress={() => setShowLowBalAlert(true)}>
                <Ionicons name="warning" size={14} color="#92400E" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.heroBalance}>₹{pocket.balance.toLocaleString('en-IN')}</Text>

          {/* Manage Funds Tab */}
          <TouchableOpacity style={styles.manageFundsTab} onPress={() => setShowManage(true)}>
            <Ionicons name="swap-vertical-outline" size={17} color={COLORS.white} />
            <Text style={styles.manageFundsTabText}>Manage Funds</Text>
            <View style={styles.manageFundsWalletBadge}>
              <Ionicons name="wallet-outline" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.manageFundsWalletText}>₹{walletBalance.toLocaleString('en-IN')}</Text>
            </View>
          </TouchableOpacity>

          {/* Scheduled Payments Tab */}
          <TouchableOpacity style={styles.scheduleTab} onPress={() => setShowSchedules(true)}>
            <Ionicons name="calendar-number-outline" size={17} color={COLORS.white} />
            <Text style={styles.scheduleTabText}>Scheduled Payments</Text>
            {(() => {
              const cnt = pocketSchedules.filter(s =>
                (s.status === 'upcoming' || s.status === 'processing') &&
                (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === curMonth,
              ).length;
              return cnt > 0 ? (
                <View style={styles.schedCountBadge}>
                  <Text style={styles.schedCountText}>{cnt}</Text>
                </View>
              ) : null;
            })()}
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Payment Options */}
        <Text style={styles.sectionTitle}>Pay from this Pocket</Text>
        <View style={styles.paymentGrid}>
          {PAYMENT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={styles.paymentOption}
              onPress={() => navigation.navigate('Payment', { pocketId, paymentType: opt.id })}
            >
              <LinearGradient colors={opt.gradient} style={styles.paymentIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name={opt.icon} size={24} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.paymentLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="arrow-down-circle-outline" size={18} color={COLORS.success} />
            <Text style={styles.statLabel}>Total In</Text>
            <Text style={styles.statVal}>₹{txCredits.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="arrow-up-circle-outline" size={18} color={COLORS.danger} />
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statVal}>₹{txDebits.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statVal}>{pocket.transactions.length}</Text>
          </View>
        </View>

        {/* Transaction History */}
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {pocket.transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyDesc}>Make a payment or add funds to see history here.</Text>
          </View>
        ) : (
          pocket.transactions.map(tx => (
            <View key={tx.id} style={styles.txItem}>
              <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? '#DCFCE7' : '#FEE2E2' }]}>
                <Ionicons
                  name={tx.type === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'}
                  size={18}
                  color={tx.type === 'credit' ? COLORS.success : COLORS.danger}
                />
              </View>
              <View style={styles.txBody}>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.type === 'credit' ? COLORS.success : COLORS.danger }]}>
                {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Low Balance Alert Modal */}
      <Modal visible={showLowBalAlert} animationType="fade" transparent onRequestClose={() => setShowLowBalAlert(false)}>
        <TouchableOpacity style={styles.alertOverlay} activeOpacity={1} onPress={() => setShowLowBalAlert(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.alertSheet}>
            <View style={styles.alertSheetHeader}>
              <View style={styles.alertSheetIconBox}>
                <Ionicons name="warning" size={22} color="#92400E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertSheetTitle}>Insufficient Balance</Text>
                <Text style={styles.alertSheetSub}>This pocket can't cover the following scheduled payments</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLowBalAlert(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current balance row */}
            <View style={styles.alertBalRow}>
              <Ionicons name="wallet-outline" size={15} color={COLORS.textSecondary} />
              <Text style={styles.alertBalLabel}>Current Balance</Text>
              <Text style={styles.alertBalAmt}>₹{pocket.balance.toLocaleString('en-IN')}</Text>
            </View>

            {/* One row per underfunded schedule */}
            {curMonthSchedules
              .filter(s => (s.status === 'upcoming' || s.status === 'paused') && pocket.balance < s.amount)
              .map(s => {
                const shortfall = s.amount - pocket.balance;
                return (
                  <View key={s.id} style={styles.alertSchedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertSchedLabel} numberOfLines={1}>{s.label || 'Scheduled Payment'}</Text>
                      <Text style={styles.alertSchedDate}>Due: {s.nextRunDate || s.scheduledDate}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={styles.alertSchedNeed}>Needs ₹{s.amount.toLocaleString('en-IN')}</Text>
                      <View style={styles.alertShortfallBadge}>
                        <Text style={styles.alertShortfallText}>Short by ₹{shortfall.toLocaleString('en-IN')}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            }

            <TouchableOpacity
              style={styles.alertAddFundsBtn}
              onPress={() => { setShowLowBalAlert(false); setShowManage(true); }}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={COLORS.white} />
              <Text style={styles.alertAddFundsText}>Add Funds to Pocket</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Scheduled Payments Modal */}
      <Modal visible={showSchedules} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSchedules(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Scheduled Payments</Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 1 }}>{pocket.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={styles.schedModalAddBtn}
                onPress={() => { setShowSchedules(false); navigation.navigate('SchedulePayment', { pocketId }); }}
              >
                <Ionicons name="add" size={16} color={COLORS.white} />
                <Text style={styles.schedModalAddText}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSchedules(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Month filter bar */}
          <View style={styles.schedMonthBarWrap}>
            <ScrollView
              ref={schedMonthScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.schedMonthBar}
            >
              {SCHED_MONTH_LIST.map(m => {
                const isActive  = m.key === activeSchedMonth;
                const hasSched  = pocketSchedules.some(s => (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === m.key);
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setSelectedSchedMonth(m.key)}
                    style={[styles.schedMonthChip, isActive && styles.schedMonthChipActive]}
                  >
                    <Text style={[styles.schedMonthChipLabel, isActive && styles.schedMonthChipLabelActive]}>{m.label}</Text>
                    <Text style={[styles.schedMonthChipYear, isActive && { color: 'rgba(255,255,255,0.75)' }]}>{m.year}</Text>
                    {hasSched && <View style={[styles.schedMonthDot, isActive && { backgroundColor: '#fff' }]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Stats row */}
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const activeInMonth = pocketSchedules.filter(
              s => (s.status === 'upcoming' || s.status === 'processing') &&
                   (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === activeSchedMonth,
            );
            const dueToday  = pocketSchedules.filter(s => (s.status === 'upcoming' || s.status === 'processing') && s.nextRunDate === today).length;
            const thisMonth = activeInMonth.length;
            const pending   = activeInMonth.reduce((sum, s) => sum + s.amount, 0);
            return (
              <View style={styles.schedStatsRow}>
                <View style={styles.schedStatChip}>
                  <Ionicons name="today-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.schedStatValue}>{dueToday}</Text>
                  <Text style={styles.schedStatLabel}>Due Today</Text>
                </View>
                <View style={styles.schedStatChip}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.schedStatValue}>{thisMonth}</Text>
                  <Text style={styles.schedStatLabel}>This Month</Text>
                </View>
                <View style={styles.schedStatChip}>
                  <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.schedStatValue}>₹{pending >= 1000 ? `${(pending/1000).toFixed(0)}k` : pending.toLocaleString('en-IN')}</Text>
                  <Text style={styles.schedStatLabel}>Pending</Text>
                </View>
              </View>
            );
          })()}

          {/* Tab bar */}
          {(() => {
            const TABS = [
              { key: 'active',    label: 'Active',           statuses: ['upcoming','processing'] },
              { key: 'paused',    label: 'Paused/Cancelled', statuses: ['paused','cancelled','failed'] },
              { key: 'completed', label: 'Completed',        statuses: ['completed'] },
            ];
            return (
              <View style={styles.schedTabBar}>
                {TABS.map(tab => {
                  const cnt = pocketSchedules.filter(s =>
                    tab.statuses.includes(s.status) &&
                    (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === activeSchedMonth,
                  ).length;
                  const active = schedTab === tab.key;
                  return (
                    <TouchableOpacity key={tab.key} style={[styles.schedTabItem, active && styles.schedTabItemActive]} onPress={() => setSchedTab(tab.key)}>
                      <Text style={[styles.schedTabLabel, active && styles.schedTabLabelActive]}>{tab.label}</Text>
                      {cnt > 0 && (
                        <View style={[styles.schedTabCount, active && styles.schedTabCountActive]}>
                          <Text style={[styles.schedTabCountTxt, active && { color: COLORS.primary }]}>{cnt}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}

          {/* Shortage alert banner */}
          {(() => {
            const checkStatuses = schedTab === 'active'
              ? ['upcoming', 'processing']
              : schedTab === 'paused'
              ? ['paused']
              : [];
            if (checkStatuses.length === 0) return null;
            const shortList = pocketSchedules.filter(s =>
              checkStatuses.includes(s.status) &&
              (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === activeSchedMonth &&
              pocket.balance < s.amount,
            );
            if (shortList.length === 0) return null;
            const totalShort = shortList.reduce((sum, s) => sum + (s.amount - pocket.balance), 0);
            return (
              <TouchableOpacity
                style={styles.schedAlertBanner}
                onPress={() => { setShowSchedules(false); setShowLowBalAlert(true); }}
                activeOpacity={0.85}
              >
                <View style={styles.schedAlertIconBox}>
                  <Ionicons name="warning" size={16} color="#92400E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schedAlertTitle}>
                    {shortList.length} payment{shortList.length > 1 ? 's' : ''} have insufficient balance
                  </Text>
                  <Text style={styles.schedAlertSub}>
                    Total shortfall · ₹{totalShort.toLocaleString('en-IN')} · Tap to view details
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#92400E" />
              </TouchableOpacity>
            );
          })()}

          <ScrollView contentContainerStyle={styles.modalBody}>
            {(() => {
              const TABS = [
                { key: 'active',    statuses: ['upcoming','processing'] },
                { key: 'paused',    statuses: ['paused','cancelled','failed'] },
                { key: 'completed', statuses: ['completed'] },
              ];
              const tab = TABS.find(t => t.key === schedTab);
              const list = pocketSchedules.filter(s =>
                tab.statuses.includes(s.status) &&
                (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === activeSchedMonth,
              );

              if (list.length === 0) return (
                <View style={styles.schedModalEmpty}>
                  <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.schedModalEmptyTitle}>No {tab?.label || schedTab} payments</Text>
                  {schedTab === 'active' && (
                    <TouchableOpacity
                      style={[styles.createBtn, { marginTop: 16, paddingHorizontal: 32 }]}
                      onPress={() => { setShowSchedules(false); navigation.navigate('SchedulePayment', { pocketId }); }}
                    >
                      <Text style={styles.createBtnText}>Schedule a Payment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );

              return list.map(s => {
                const meta = SCHED_STATUS_META[s.status] || SCHED_STATUS_META.upcoming;
                const recLabel = RECURRENCE[s.recurrence]?.label || s.recurrence;
                const isLowBal = pocket.balance < s.amount && (s.status === 'upcoming' || s.status === 'paused');
                return (
                  <View key={s.id} style={[styles.schedModalItem, isLowBal && styles.schedModalItemWarn]}>
                    <View style={styles.schedModalItemTop}>
                      <View style={[styles.schedModalIconBox, { backgroundColor: meta.bg }]}>
                        <Ionicons name="calendar-number-outline" size={18} color={meta.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.schedModalItemLabel} numberOfLines={1}>{s.label || 'Payment'}</Text>
                        <Text style={styles.schedModalItemMeta}>{recLabel} · {s.nextRunDate || s.scheduledDate}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.schedModalItemAmt}>₹{s.amount.toLocaleString('en-IN')}</Text>
                        <View style={[styles.schedStatusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.schedStatusText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      </View>
                    </View>
                    {s.recipient ? <Text style={styles.schedModalItemRecipient}>To: {s.recipient}</Text> : null}

                    {/* Active actions */}
                    {s.status === 'upcoming' && (
                      <View style={styles.schedActionRow}>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); runScheduleNow(s.id); }}>
                          <Ionicons name="play-outline" size={14} color={COLORS.success} />
                          <Text style={[styles.schedActionTxt, { color: COLORS.success }]}>Run Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => pauseSchedule(s.id)}>
                          <Ionicons name="pause-outline" size={14} color='#D97706' />
                          <Text style={[styles.schedActionTxt, { color: '#D97706' }]}>Pause</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => { setShowSchedules(false); navigation.navigate('SchedulePayment', { scheduleId: s.id }); }}>
                          <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                          <Text style={[styles.schedActionTxt, { color: COLORS.primary }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => Alert.alert('Cancel Schedule', `Cancel "${s.label || 'this payment'}"?`, [{ text: 'Keep it', style: 'cancel' }, { text: 'Cancel', style: 'destructive', onPress: () => cancelSchedule(s.id) }])}>
                          <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
                          <Text style={[styles.schedActionTxt, { color: COLORS.danger }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Paused actions */}
                    {s.status === 'paused' && (
                      <View style={styles.schedActionRow}>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => resumeSchedule(s.id)}>
                          <Ionicons name="play-circle-outline" size={14} color={COLORS.primary} />
                          <Text style={[styles.schedActionTxt, { color: COLORS.primary }]}>Resume</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => { setShowSchedules(false); navigation.navigate('SchedulePayment', { scheduleId: s.id }); }}>
                          <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                          <Text style={[styles.schedActionTxt, { color: COLORS.primary }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.schedActionBtn} onPress={() => Alert.alert('Cancel Schedule', `Cancel "${s.label || 'this payment'}"?`, [{ text: 'Keep it', style: 'cancel' }, { text: 'Cancel', style: 'destructive', onPress: () => cancelSchedule(s.id) }])}>
                          <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
                          <Text style={[styles.schedActionTxt, { color: COLORS.danger }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              });
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Manage Modal */}
      <Modal visible={showManage} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowManage(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Funds</Text>
            <TouchableOpacity onPress={() => setShowManage(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.fundRow}>
              <View style={styles.fundItem}>
                <Text style={styles.fundLabel}>Pocket Balance</Text>
                <Text style={styles.fundAmt}>₹{pocket.balance.toLocaleString('en-IN')}</Text>
              </View>
              <Ionicons name="swap-horizontal-outline" size={24} color={COLORS.textSecondary} />
              <View style={styles.fundItem}>
                <Text style={styles.fundLabel}>Wallet</Text>
                <Text style={styles.fundAmt}>₹{walletBalance.toLocaleString('en-IN')}</Text>
              </View>
            </View>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={manageAmount}
                onChangeText={setManageAmount}
                placeholder="0"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <View style={styles.manageActions}>
              <TouchableOpacity style={[styles.manageBtn, { backgroundColor: COLORS.success }]} onPress={() => handleAllocate('add')}>
                <Ionicons name="arrow-down-outline" size={20} color={COLORS.white} />
                <Text style={styles.manageBtnText}>Add to Pocket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.manageBtn, { backgroundColor: COLORS.info }]} onPress={() => handleAllocate('withdraw')}>
                <Ionicons name="arrow-up-outline" size={20} color={COLORS.white} />
                <Text style={styles.manageBtnText}>Move to Wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Edit Pocket Modal */}
      <Modal visible={showRename} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRename(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Pocket</Text>
            <TouchableOpacity onPress={() => setShowRename(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Pocket Name</Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 24 }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Pocket name"
              placeholderTextColor={COLORS.textLight}
              autoFocus
              maxLength={30}
            />
            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.editPriorityRow}>
              {['high','medium','low'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.editPriorityOption, newPriority === p && styles.editPriorityOptionActive]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text style={styles.editPriorityStars}>{PRIORITY_CONFIG[p].stars}</Text>
                  <Text style={[styles.editPriorityLabel, newPriority === p && { color: COLORS.primary, fontWeight: '700' }]}>
                    {PRIORITY_CONFIG[p].label}
                  </Text>
                  {newPriority === p && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.createBtn, { marginTop: 8 }]} onPress={handleRename}>
              <Text style={styles.createBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },
  heroCard: { borderRadius: RADIUS.xl, padding: 22, marginBottom: 14, ...SHADOWS.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroActionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  heroBalance: { fontSize: 38, fontWeight: '800', color: COLORS.white, letterSpacing: -1, marginBottom: 16 },
  manageFundsTab: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16 },
  manageFundsTabText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.white },
  manageFundsWalletBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  manageFundsWalletText: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  scheduleTab: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16 },
  scheduleTabText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.white },
  statsCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 20, ...SHADOWS.sm },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#E2E8F0' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  statVal: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 20 },
  alertSheet: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, ...SHADOWS.lg },
  alertSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  alertSheetIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  alertSheetTitle: { fontSize: 16, fontWeight: '800', color: '#92400E' },
  alertSheetSub: { fontSize: 12, color: '#B45309', marginTop: 2, lineHeight: 16 },
  alertBalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  alertBalLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  alertBalAmt: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  alertSchedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10 },
  alertSchedLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  alertSchedDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  alertSchedNeed: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  alertShortfallBadge: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  alertShortfallText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  alertAddFundsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  alertAddFundsText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  heroAlertBadge: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  schedModalItemWarn: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  schedCountBadge: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  schedCountText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  schedStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  schedStatusText: { fontSize: 10, fontWeight: '700' },
  schedTabBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 4, marginTop: 8, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  schedTabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  schedTabItemActive: { backgroundColor: COLORS.white, ...SHADOWS.sm },
  schedTabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  schedTabLabelActive: { color: COLORS.primary, fontWeight: '700' },
  schedTabCount: { backgroundColor: '#E2E8F0', borderRadius: 8, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center' },
  schedTabCountActive: { backgroundColor: COLORS.primary + '20' },
  schedTabCountTxt: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  schedActionRow: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  schedActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F8FAFC' },
  schedActionTxt: { fontSize: 11, fontWeight: '700' },
  schedModalAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  schedModalAddText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  schedModalEmpty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  schedModalEmptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  schedModalEmptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  schedModalItem: { backgroundColor: '#F8FAFC', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  schedModalItemTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  schedModalIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  schedModalItemLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  schedModalItemMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  schedModalItemAmt: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  schedModalItemRecipient: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, marginLeft: 52 },
  schedModalCancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, marginLeft: 52 },
  schedModalCancelText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  editPriorityRow: { gap: 8, marginBottom: 8 },
  editPriorityOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0' },
  editPriorityOptionActive: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  editPriorityStars: { fontSize: 16 },
  editPriorityLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  paymentOption: { width: '47%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', gap: 10, ...SHADOWS.sm },
  paymentIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  paymentLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  emptyState: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 32, alignItems: 'center', gap: 8, ...SHADOWS.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  txItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, gap: 12, ...SHADOWS.sm },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txBody: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  txDate: { fontSize: 12, color: COLORS.textLight },
  txAmount: { fontSize: 15, fontWeight: '700' },
  modalSafe: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: 20 },
  fundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: RADIUS.md, padding: 16, marginBottom: 20 },
  fundItem: { alignItems: 'center', gap: 4 },
  fundLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  fundAmt: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 16, gap: 8, marginBottom: 20 },
  rupee: { fontSize: 22, fontWeight: '700', color: COLORS.textSecondary },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: COLORS.text, paddingVertical: 14 },
  manageActions: { flexDirection: 'row', gap: 12 },
  manageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.md, paddingVertical: 15 },
  manageBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  textInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text, marginBottom: 20 },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  // Shortage alert banner
  schedAlertBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 10, backgroundColor: '#FFFBEB', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#FCD34D' },
  schedAlertIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  schedAlertTitle:   { fontSize: 13, fontWeight: '700', color: '#92400E' },
  schedAlertSub:     { fontSize: 11, color: '#B45309', marginTop: 2 },
  // Stats row — matches ScheduledPaymentsScreen stat chips
  schedStatsRow:  { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  schedStatChip:  { flex: 1, backgroundColor: COLORS.primary + '10', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  schedStatValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  schedStatLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  // Month filter bar — matches ScheduledPaymentsScreen
  schedMonthBarWrap: { backgroundColor: COLORS.white, paddingVertical: 10, ...SHADOWS.sm },
  schedMonthBar: { paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center' },
  schedMonthChip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#F1F5F9', gap: 2 },
  schedMonthChipActive: { backgroundColor: COLORS.primary },
  schedMonthChipLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  schedMonthChipLabelActive: { color: '#fff' },
  schedMonthChipYear: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  schedMonthDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
});
