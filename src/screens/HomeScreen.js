import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet, PRIORITY_CONFIG, POCKET_COLORS } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';
import PocketCard from '../components/PocketCard';

export default function HomeScreen({ navigation }) {
  const {
    walletBalance, sortedPockets, totalBalance, totalInPockets,
    unreadCount, addMoneyToWallet, createPocket, allocateToPocket,
    scheduledPayments,
  } = useWallet();

  // Pockets whose balance can't cover at least one current-month scheduled payment
  const curMonth = new Date().toISOString().slice(0, 7);
  const shortPockets = sortedPockets
    .map(p => {
      const shortages = scheduledPayments.filter(
        s => s.pocketId === p.id &&
             (s.status === 'upcoming' || s.status === 'paused') &&
             (s.nextRunDate || s.scheduledDate || '').slice(0, 7) === curMonth &&
             p.balance < s.amount,
      );
      return shortages.length > 0 ? { pocket: p, shortages } : null;
    })
    .filter(Boolean);
  const { signOut, user } = useAuth();

  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showShortages, setShowShortages] = useState(false);
  const [showCreatePocket, setShowCreatePocket] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [newPocketName, setNewPocketName] = useState('');
  const [newPocketPriority, setNewPocketPriority] = useState('medium');
  const [refreshing, setRefreshing] = useState(false);
  const [sendTab, setSendTab] = useState('pocket'); // 'pocket' | 'other'
  const [sendAmount, setSendAmount] = useState('');
  const [selectedPocketId, setSelectedPocketId] = useState(null);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleAddMoney = (method) => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid amount'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addMoneyToWallet(amount, method);
    setAddAmount('');
    setShowAddMoney(false);
  };

  const handleCreatePocket = () => {
    if (!newPocketName.trim()) { Alert.alert('Enter pocket name'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createPocket(newPocketName.trim(), newPocketPriority);
    setNewPocketName('');
    setNewPocketPriority('medium');
    setShowCreatePocket(false);
  };

  const handleSendToPocket = () => {
    const amount = parseFloat(sendAmount);
    if (!amount || amount <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount.'); return; }
    if (!selectedPocketId) { Alert.alert('Select a pocket', 'Choose which pocket to send to.'); return; }
    if (amount > walletBalance) { Alert.alert('Insufficient funds', `Wallet balance is ₹${walletBalance.toLocaleString('en-IN')}.`); return; }
    const ok = allocateToPocket(selectedPocketId, amount);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSendAmount(''); setSelectedPocketId(null); setShowSend(false);
    } else {
      Alert.alert('Transfer failed', 'Not enough balance in wallet.');
    }
  };

  const SEND_PAYMENT_OPTIONS = [
    { id: 'upi-qr',    icon: 'qr-code-outline',      label: 'Scan & Pay',       gradient: ['#7C3AED','#EC4899'] },
    { id: 'upi-phone', icon: 'call-outline',          label: 'UPI Phone No.',    gradient: ['#2563EB','#06B6D4'] },
    { id: 'upi-id',    icon: 'at-circle-outline',     label: 'UPI ID',           gradient: ['#4F46E5','#7C3AED'] },
    { id: 'bank',      icon: 'business-outline',      label: 'Bank Transfer',    gradient: ['#059669','#10B981'] },
    { id: 'card',      icon: 'card-outline',          label: 'Card Payment',     gradient: ['#0EA5E9','#4F46E5'] },
  ];

  const PAYMENT_METHODS = [
    { key: 'UPI', icon: 'phone-portrait-outline', gradient: ['#7C3AED', '#EC4899'] },
    { key: 'Net Banking', icon: 'business-outline', gradient: ['#2563EB', '#06B6D4'] },
    { key: 'Debit/Credit Card', icon: 'card-outline', gradient: ['#059669', '#10B981'] },
    { key: 'Bank Transfer', icon: 'swap-horizontal-outline', gradient: ['#D97706', '#F59E0B'] },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={['#6C63FF','#EC4899']} style={styles.logoBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ fontSize:16, fontWeight:'800', color:'#fff' }}>{user?.avatar || '💰'}</Text>
            </LinearGradient>
            <View>
              <Text style={styles.appName}>Hi, {user?.name?.split(' ')[0] || 'there'}! 👋</Text>
              <Text style={{ fontSize:11, color:COLORS.textSecondary, marginTop:1 }}>{user?.email || 'PocketWallet'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.secureChip}
              onPress={() => signOut()}
            >
              <Ionicons name="log-out-outline" size={13} color={COLORS.textSecondary} />
              <Text style={[styles.secureText, {color:COLORS.textSecondary}]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <LinearGradient colors={['#4F46E5', '#3B82F6', '#06B6D4']} style={styles.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>₹{totalBalance.toLocaleString('en-IN')}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Ionicons name="wallet-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.balanceItemLabel}>Wallet</Text>
              <Text style={styles.balanceItemAmount}>₹{walletBalance.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Ionicons name="layers-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.balanceItemLabel}>In Pockets</Text>
              <Text style={styles.balanceItemAmount}>₹{totalInPockets.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            {[
              { icon: 'arrow-up-circle-outline', label: 'Send', action: () => { setSendTab('pocket'); setSendAmount(''); setSelectedPocketId(null); setShowSend(true); } },
              { icon: 'arrow-down-circle-outline', label: 'Add', action: () => setShowAddMoney(true) },
              { icon: 'bar-chart-outline', label: 'Report', screen: 'Report' },
            ].map(a => (
              <TouchableOpacity key={a.label} style={styles.qaItem} onPress={a.action || (() => navigation.navigate(a.screen))}>
                <View style={styles.qaIcon}><Ionicons name={a.icon} size={22} color={COLORS.white} /></View>
                <Text style={styles.qaLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            {/* Alerts quick action */}
            <TouchableOpacity style={styles.qaItem} onPress={() => shortPockets.length > 0 ? setShowShortages(true) : navigation.navigate('Notifications')}>
              <View style={styles.qaIcon}>
                <Ionicons name="warning-outline" size={22} color={COLORS.white} />
                {shortPockets.length > 0 && (
                  <View style={styles.qaAlertDot}><Text style={styles.qaAlertDotText}>{shortPockets.length}</Text></View>
                )}
              </View>
              <Text style={styles.qaLabel}>Alerts</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>


        {/* Pockets Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Pockets <Text style={styles.sectionCount}>({sortedPockets.length}/100)</Text></Text>
          <TouchableOpacity style={styles.newPocketBtn} onPress={() => setShowCreatePocket(true)}>
            <Ionicons name="add" size={16} color={COLORS.primary} />
            <Text style={styles.newPocketText}>New Pocket</Text>
          </TouchableOpacity>
        </View>

        {/* Pocket Cards */}
        {sortedPockets.map(pocket => (
          <PocketCard
            key={pocket.id}
            pocket={pocket}
            totalBalance={totalBalance}
            onPress={() => navigation.navigate('PocketDetail', { pocketId: pocket.id })}
          />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Pocket Shortage Modal */}
      <Modal visible={showShortages} animationType="fade" transparent onRequestClose={() => setShowShortages(false)}>
        <TouchableOpacity style={styles.shortageOverlay} activeOpacity={1} onPress={() => setShowShortages(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.shortageSheet}>
            <View style={styles.shortageHeader}>
              <View style={styles.shortageIconBox}>
                <Ionicons name="warning" size={22} color="#92400E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shortageTitle}>Balance Shortage</Text>
                <Text style={styles.shortageSub}>{shortPockets.length} pocket{shortPockets.length > 1 ? 's' : ''} can't cover scheduled payments</Text>
              </View>
              <TouchableOpacity onPress={() => setShowShortages(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {shortPockets.map(({ pocket, shortages }) => (
              <TouchableOpacity
                key={pocket.id}
                style={styles.shortagePocketRow}
                onPress={() => { setShowShortages(false); navigation.navigate('PocketDetail', { pocketId: pocket.id }); }}
              >
                <View style={[styles.shortagePocketDot, { backgroundColor: pocket.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.shortagePocketName}>{pocket.name}</Text>
                  <Text style={styles.shortagePocketBal}>Balance: ₹{pocket.balance.toLocaleString('en-IN')}</Text>
                  {shortages.map(s => (
                    <Text key={s.id} style={styles.shortageSchedLine}>
                      · {s.label || 'Payment'} needs ₹{s.amount.toLocaleString('en-IN')} — short by ₹{(s.amount - pocket.balance).toLocaleString('en-IN')}
                    </Text>
                  ))}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Money Modal */}
      <Modal visible={showAddMoney} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMoney(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Money</Text>
            <TouchableOpacity onPress={() => setShowAddMoney(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={addAmount}
                onChangeText={setAddAmount}
                placeholder="0"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <Text style={[styles.inputLabel, { marginTop: 24 }]}>Select Payment Method</Text>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity key={m.key} style={styles.methodRow} onPress={() => handleAddMoney(m.key)}>
                <LinearGradient colors={m.gradient} style={styles.methodIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name={m.icon} size={20} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.methodLabel}>{m.key}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Send Money Modal */}
      <Modal visible={showSend} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSend(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Money</Text>
            <TouchableOpacity onPress={() => setShowSend(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={styles.sendTabRow}>
            <TouchableOpacity
              style={[styles.sendTab, sendTab === 'pocket' && styles.sendTabActive]}
              onPress={() => setSendTab('pocket')}
            >
              <Ionicons name="layers-outline" size={15} color={sendTab === 'pocket' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.sendTabText, sendTab === 'pocket' && styles.sendTabTextActive]}>To Pocket</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendTab, sendTab === 'other' && styles.sendTabActive]}
              onPress={() => setSendTab('other')}
            >
              <Ionicons name="send-outline" size={15} color={sendTab === 'other' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.sendTabText, sendTab === 'other' && styles.sendTabTextActive]}>To Others</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Wallet balance chip */}
            <View style={styles.walletChip}>
              <Ionicons name="wallet-outline" size={14} color={COLORS.primary} />
              <Text style={styles.walletChipText}>Wallet Balance: <Text style={{ fontWeight: '800', color: COLORS.primary }}>₹{walletBalance.toLocaleString('en-IN')}</Text></Text>
            </View>

            {sendTab === 'pocket' ? (
              <>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    placeholder="0"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <Text style={[styles.inputLabel, { marginTop: 20 }]}>Choose Pocket</Text>
                {sortedPockets.length === 0 ? (
                  <View style={styles.noPocketsBox}>
                    <Ionicons name="layers-outline" size={32} color={COLORS.textLight} />
                    <Text style={styles.noPocketsText}>No pockets yet. Create one first.</Text>
                  </View>
                ) : (
                  sortedPockets.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.pocketSelectRow, selectedPocketId === p.id && styles.pocketSelectRowActive]}
                      onPress={() => setSelectedPocketId(p.id)}
                    >
                      <View style={[styles.pocketSelectDot, { backgroundColor: p.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pocketSelectName}>{p.name}</Text>
                        <Text style={styles.pocketSelectBal}>₹{p.balance.toLocaleString('en-IN')}</Text>
                      </View>
                      {selectedPocketId === p.id
                        ? <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                        : <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                      }
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity style={[styles.createBtn, { marginTop: 24 }]} onPress={handleSendToPocket}>
                  <Text style={styles.createBtnText}>Send to Pocket</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={sendAmount}
                    onChangeText={setSendAmount}
                    placeholder="0"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <Text style={[styles.inputLabel, { marginTop: 20 }]}>Choose Payment Method</Text>
                {SEND_PAYMENT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={styles.methodRow}
                    onPress={() => {
                      const amount = parseFloat(sendAmount);
                      if (!amount || amount <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount first.'); return; }
                      if (amount > walletBalance) { Alert.alert('Insufficient funds', `Wallet balance is ₹${walletBalance.toLocaleString('en-IN')}.`); return; }
                      setShowSend(false);
                      setSendAmount('');
                      navigation.navigate('Payment', { pocketId: null, paymentType: opt.id, fromWallet: true, amount });
                    }}
                  >
                    <LinearGradient colors={opt.gradient} style={styles.methodIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Ionicons name={opt.icon} size={20} color={COLORS.white} />
                    </LinearGradient>
                    <Text style={styles.methodLabel}>{opt.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Create Pocket Modal */}
      <Modal visible={showCreatePocket} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreatePocket(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Pocket</Text>
            <TouchableOpacity onPress={() => setShowCreatePocket(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Pocket Name</Text>
            <TextInput
              style={styles.textInput}
              value={newPocketName}
              onChangeText={setNewPocketName}
              placeholder="e.g. Emergency Fund"
              placeholderTextColor={COLORS.textLight}
              maxLength={30}
            />
            <Text style={[styles.inputLabel, { marginTop: 20 }]}>Priority Level</Text>
            <View style={styles.priorityRow}>
              {['high','medium','low'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, newPocketPriority === p && styles.priorityBtnActive]}
                  onPress={() => setNewPocketPriority(p)}
                >
                  <Text style={styles.priorityStars}>{PRIORITY_CONFIG[p].stars}</Text>
                  <Text style={[styles.priorityLabel, newPocketPriority === p && { color: COLORS.primary }]}>
                    {PRIORITY_CONFIG[p].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreatePocket}>
              <Text style={styles.createBtnText}>Create Pocket</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  badge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  secureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  secureText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
  balanceCard: { borderRadius: RADIUS.xl, padding: 22, marginBottom: 24, ...SHADOWS.lg },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceLabel: { fontSize: 18, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: COLORS.white, letterSpacing: -1, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, marginBottom: 18 },
  balanceItem: { flex: 1, alignItems: 'center', gap: 3 },
  balanceDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  balanceItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  balanceItemAmount: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
  qaItem: { alignItems: 'center', gap: 5 },
  qaIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sectionCount: { fontSize: 14, fontWeight: '400', color: COLORS.textSecondary },
  newPocketBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  newPocketText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  modalSafe: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 16, gap: 8 },
  rupee: { fontSize: 22, fontWeight: '700', color: COLORS.textSecondary },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '800', color: COLORS.text, paddingVertical: 14 },
  methodRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#F8FAFC', borderRadius: RADIUS.md, marginBottom: 10, gap: 14 },
  methodIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  textInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  priorityBtn: { flex: 1, alignItems: 'center', padding: 14, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: RADIUS.md, backgroundColor: '#F8FAFC' },
  priorityBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  priorityStars: { fontSize: 16, marginBottom: 4 },
  priorityLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceAlertBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FDE68A', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  balanceAlertCount: { fontSize: 11, fontWeight: '800', color: '#92400E' },
  qaAlertDot: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' },
  qaAlertDotText: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  shortageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 20 },
  shortageSheet: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, ...SHADOWS.lg },
  shortageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  shortageIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  shortageTitle: { fontSize: 16, fontWeight: '800', color: '#92400E' },
  shortageSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  shortagePocketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  shortagePocketDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  shortagePocketName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  shortagePocketBal: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  shortageSchedLine: { fontSize: 11, color: '#DC2626', marginTop: 3, lineHeight: 16 },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  sendTabRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  sendTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  sendTabActive: { backgroundColor: COLORS.white, ...SHADOWS.sm },
  sendTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  sendTabTextActive: { color: COLORS.primary },
  walletChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  walletChipText: { fontSize: 13, color: COLORS.text },
  pocketSelectRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: RADIUS.md, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1.5, borderColor: 'transparent' },
  pocketSelectRowActive: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  pocketSelectDot: { width: 14, height: 14, borderRadius: 7 },
  pocketSelectName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  pocketSelectBal: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  noPocketsBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  noPocketsText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});
