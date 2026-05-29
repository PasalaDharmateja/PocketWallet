/**
 * SchedulePaymentScreen.js
 * Create or edit a scheduled payment for a pocket.
 * Route params:
 *   pocketId?       – pre-selects the source pocket (optional)
 *   scheduleId?     – if set, edits an existing schedule
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useWallet, RECURRENCE, PAY_METHOD } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

// ── helpers ────────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m-1]} ${+day}, ${y}`;
};

const nextNDates = (n = 30) => {
  const dates = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS  = ['00', '15', '30', '45'];
const PAYMENT_TYPES = [
  { key: 'upi-id',    label: 'UPI ID',        icon: 'at-circle-outline',   color: '#4F46E5' },
  { key: 'upi-phone', label: 'UPI Phone',      icon: 'call-outline',        color: '#2563EB' },
  { key: 'bank',      label: 'Bank Transfer',  icon: 'business-outline',    color: '#059669' },
  { key: 'pocket',    label: 'Add to Pocket',  icon: 'layers-outline',      color: '#7C3AED' },
];

// ── component ──────────────────────────────────────────────────────────────────
export default function SchedulePaymentScreen({ route, navigation }) {
  const { pocketId: routePocketId, scheduleId } = route.params || {};
  const { pockets, scheduledPayments, createSchedule, editSchedule } = useWallet();

  // If editing, pre-load existing schedule
  const existing = scheduleId ? scheduledPayments.find(s => s.id === scheduleId) : null;

  const [label,       setLabel]       = useState(existing?.label       || '');
  const [payType,     setPayType]     = useState(existing?.paymentType || 'upi-id');
  const [recipient,   setRecipient]   = useState(existing?.recipient   || '');
  const [ifsc,        setIfsc]        = useState(existing?.ifsc        || '');
  const [toPocketId,  setToPocketId]  = useState(existing?.toPocketId  || '');
  const [amount,      setAmount]      = useState(existing ? String(existing.amount) : '');
  const [pocketId,    setPocketId]    = useState(existing?.pocketId    || routePocketId || '');
  const [recurrence,  setRecurrence]  = useState(existing?.recurrence  || 'monthly');
  const [schedDate,   setSchedDate]   = useState(existing?.scheduledDate || '');
  const [schedHour,   setSchedHour]   = useState((existing?.scheduledTime || '09:00').split(':')[0]);
  const [schedMin,    setSchedMin]    = useState((existing?.scheduledTime || '09:00').split(':')[1] || '00');
  const [endDate,     setEndDate]     = useState(existing?.endDate     || '');
  const [note,        setNote]        = useState(existing?.note        || '');

  const [showPocketPicker,   setShowPocketPicker]   = useState(false);
  const [showToPocketPicker, setShowToPocketPicker] = useState(false);
  const [showDatePicker,     setShowDatePicker]     = useState(false);
  const [showTimePicker,     setShowTimePicker]     = useState(false);
  const [showEndDatePicker,  setShowEndDatePicker]  = useState(false);
  const [saved,              setSaved]              = useState(false);

  const sourcePocket = pockets.find(p => p.id === pocketId);
  const targetPocket = pockets.find(p => p.id === toPocketId);
  const dateList     = useMemo(() => nextNDates(90), []);

  // ── validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const amt = parseFloat(amount);
    if (!label.trim())    { Alert.alert('Label Required', 'Give this schedule a name.'); return false; }
    if (!amt || amt <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return false; }
    if (!schedDate)       { Alert.alert('Date Required', 'Pick a scheduled date.'); return false; }

    if (payType === 'pocket') {
      if (!toPocketId) { Alert.alert('Select Pocket', 'Choose a destination pocket.'); return false; }
      if (toPocketId === pocketId) { Alert.alert('Same Pocket', 'Source and destination cannot be the same.'); return false; }
    } else {
      if (!recipient.trim()) { Alert.alert('Recipient Required', payType === 'bank' ? 'Enter account number.' : 'Enter UPI ID or phone.'); return false; }
      if (payType === 'bank' && ifsc.length < 11) { Alert.alert('Invalid IFSC', 'IFSC must be 11 characters.'); return false; }
      if (payType === 'upi-phone' && recipient.replace(/\D/g,'').length !== 10) { Alert.alert('Invalid Phone', 'Enter a 10-digit mobile number.'); return false; }
      if (!pocketId) { Alert.alert('Source Required', 'Select which pocket to pay from.'); return false; }
    }
    return true;
  };

  // ── save ────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!validate()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      label: label.trim(),
      paymentType: payType,
      recipient:   payType !== 'pocket' ? recipient.trim() : null,
      ifsc:        payType === 'bank'   ? ifsc.trim().toUpperCase() : null,
      toPocketId:  payType === 'pocket' ? toPocketId  : null,
      toPocketName: payType === 'pocket' ? targetPocket?.name : null,
      amount:       parseFloat(amount),
      pocketId:     payType === 'pocket' && !pocketId ? null : pocketId,
      pocketName:   sourcePocket ? sourcePocket.name : 'Wallet',
      recurrence,
      scheduledDate: schedDate,
      scheduledTime: `${schedHour}:${schedMin}`,
      endDate:      recurrence !== 'once' && endDate ? endDate : null,
      note: note.trim(),
    };

    if (existing) {
      editSchedule(existing.id, data);
    } else {
      createSchedule(data);
    }
    setSaved(true);
  };

  // ── saved success screen ────────────────────────────────────────────────────
  if (saved) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <LinearGradient colors={['#7C3AED','#4F46E5']} style={s.successIcon}>
            <Ionicons name="calendar-number" size={48} color="#fff" />
          </LinearGradient>
          <Text style={s.successTitle}>Scheduled!</Text>
          <Text style={s.successLabel}>{label}</Text>
          <Text style={s.successMeta}>₹{parseFloat(amount).toLocaleString('en-IN')} · {fmtDate(schedDate)} at {schedHour}:{schedMin}</Text>
          <View style={s.successDetail}>
            <SRow icon="repeat-outline"       label="Repeats"  value={RECURRENCE[recurrence].label} />
            <SRow icon="layers-outline"       label="Source"   value={sourcePocket ? sourcePocket.name : 'Wallet'} />
            {payType === 'pocket' && targetPocket && (
              <SRow icon="arrow-forward-outline" label="Destination" value={targetPocket.name} />
            )}
            {payType !== 'pocket' && recipient && (
              <SRow icon={PAY_METHOD[payType]?.icon || 'send-outline'} label="To" value={recipient} />
            )}
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnTxt}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.anotherBtn} onPress={() => {
            setSaved(false); setLabel(''); setRecipient(''); setAmount('');
            setSchedDate(''); setNote(''); setToPocketId('');
          }}>
            <Text style={s.anotherBtnTxt}>Schedule Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isEditing = !!existing;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <LinearGradient colors={['#7C3AED','#4F46E5']} style={s.hero} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Ionicons name="calendar-number-outline" size={32} color="#fff" />
            <Text style={s.heroTitle}>{isEditing ? 'Edit Schedule' : 'Schedule Payment'}</Text>
            <Text style={s.heroSub}>Set it once, runs automatically</Text>
          </LinearGradient>

          {/* ── Label ── */}
          <Card title="Payment Name">
            <View style={s.fieldRow}>
              <Ionicons name="pencil-outline" size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
              <TextInput
                style={s.fieldInput}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Monthly Rent, Netflix"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          </Card>

          {/* ── Payment type ── */}
          <Card title="Payment Type">
            <View style={s.typeGrid}>
              {PAYMENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typeTile, payType === t.key && { borderColor: t.color, backgroundColor: t.color + '12' }]}
                  onPress={() => { setPayType(t.key); setRecipient(''); setToPocketId(''); }}
                >
                  <Ionicons name={t.icon} size={22} color={payType === t.key ? t.color : COLORS.textSecondary} />
                  <Text style={[s.typeTileText, payType === t.key && { color: t.color, fontWeight: '700' }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* ── Recipient / Destination ── */}
          {payType === 'pocket' ? (
            <Card title="From → To">
              {/* Source */}
              <Label>Pay From</Label>
              <TouchableOpacity style={s.selectorRow} onPress={() => setShowPocketPicker(true)}>
                <View style={[s.selectorDot, { backgroundColor: sourcePocket?.color || '#E2E8F0' }]} />
                <Text style={[s.selectorText, !sourcePocket && { color: COLORS.textLight }]}>
                  {sourcePocket ? `${sourcePocket.name}  ·  ₹${sourcePocket.balance.toLocaleString('en-IN')}` : 'Tap to select pocket (or leave for Wallet)'}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <View style={{ height: 14 }} />
              <Label>Add to Pocket</Label>
              <TouchableOpacity style={[s.selectorRow, !toPocketId && s.selectorRowRequired]} onPress={() => setShowToPocketPicker(true)}>
                <View style={[s.selectorDot, { backgroundColor: targetPocket?.color || '#E2E8F0' }]} />
                <Text style={[s.selectorText, !targetPocket && { color: COLORS.textLight }]}>
                  {targetPocket ? `${targetPocket.name}  ·  ₹${targetPocket.balance.toLocaleString('en-IN')}` : 'Select destination pocket *'}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </Card>
          ) : (
            <Card title="Recipient">
              {payType !== 'upi-qr' && (
                <>
                  <Label>{payType === 'upi-id' ? 'UPI ID' : payType === 'upi-phone' ? 'Mobile Number' : 'Account Number'}</Label>
                  <View style={s.fieldRow}>
                    <Ionicons name={payType === 'upi-phone' ? 'call-outline' : payType === 'bank' ? 'card-outline' : 'at-circle-outline'} size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
                    <TextInput
                      style={s.fieldInput}
                      value={recipient}
                      onChangeText={setRecipient}
                      placeholder={payType === 'upi-id' ? 'name@okaxis' : payType === 'upi-phone' ? '9876543210' : '1234567890123'}
                      placeholderTextColor={COLORS.textLight}
                      keyboardType={payType !== 'upi-id' ? 'numeric' : 'email-address'}
                      autoCapitalize="none"
                      maxLength={payType === 'upi-phone' ? 10 : undefined}
                    />
                  </View>
                  {payType === 'bank' && (
                    <>
                      <Label style={{ marginTop: 12 }}>IFSC Code</Label>
                      <View style={s.fieldRow}>
                        <Ionicons name="code-outline" size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
                        <TextInput
                          style={s.fieldInput}
                          value={ifsc}
                          onChangeText={v => setIfsc(v.toUpperCase())}
                          placeholder="ABCD0123456"
                          placeholderTextColor={COLORS.textLight}
                          autoCapitalize="characters"
                          maxLength={11}
                        />
                      </View>
                    </>
                  )}
                </>
              )}

              <Label style={{ marginTop: 14 }}>Pay From Pocket</Label>
              <TouchableOpacity style={[s.selectorRow, !pocketId && s.selectorRowRequired]} onPress={() => setShowPocketPicker(true)}>
                <View style={[s.selectorDot, { backgroundColor: sourcePocket?.color || '#E2E8F0' }]} />
                <Text style={[s.selectorText, !sourcePocket && { color: COLORS.textLight }]}>
                  {sourcePocket ? `${sourcePocket.name}  ·  ₹${sourcePocket.balance.toLocaleString('en-IN')}` : 'Select source pocket *'}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </Card>
          )}

          {/* ── Amount ── */}
          <Card title="Amount">
            <View style={s.amtRow}>
              <Text style={s.rupee}>₹</Text>
              <TextInput
                style={s.amtInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <View style={s.quickRow}>
              {[500,1000,2000,5000,10000].map(a => (
                <TouchableOpacity key={a} style={[s.quickBtn, parseFloat(amount)===a && s.quickBtnActive]} onPress={() => setAmount(String(a))}>
                  <Text style={[s.quickBtnTxt, parseFloat(amount)===a && s.quickBtnTxtActive]}>₹{(a/1000)>0 ? a>=1000 ? `${a/1000}k`:a : a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* ── Schedule ── */}
          <Card title="Schedule">
            {/* Date */}
            <Label>Start Date</Label>
            <TouchableOpacity style={s.selectorRow} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
              <Text style={[s.selectorText, !schedDate && { color: COLORS.textLight }]}>
                {schedDate ? fmtDate(schedDate) : 'Select a date *'}
              </Text>
              <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Time */}
            <Label style={{ marginTop: 12 }}>Time</Label>
            <TouchableOpacity style={s.selectorRow} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
              <Text style={s.selectorText}>{schedHour}:{schedMin}</Text>
              <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Recurrence */}
            <Label style={{ marginTop: 14 }}>Repeats</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recRow}>
              {Object.entries(RECURRENCE).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.recChip, recurrence === key && s.recChipActive]}
                  onPress={() => setRecurrence(key)}
                >
                  <Text style={[s.recChipTxt, recurrence === key && s.recChipTxtActive]}>{cfg.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* End date (only for recurring) */}
            {recurrence !== 'once' && (
              <>
                <Label style={{ marginTop: 12 }}>End Date (Optional)</Label>
                <TouchableOpacity style={s.selectorRow} onPress={() => setShowEndDatePicker(true)}>
                  <Ionicons name="stop-circle-outline" size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
                  <Text style={[s.selectorText, !endDate && { color: COLORS.textLight }]}>
                    {endDate ? fmtDate(endDate) : 'No end date (runs forever)'}
                  </Text>
                  {endDate && (
                    <TouchableOpacity onPress={() => setEndDate('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}
                  {!endDate && <Ionicons name="chevron-down-outline" size={18} color={COLORS.textSecondary} />}
                </TouchableOpacity>
              </>
            )}
          </Card>

          {/* ── Note ── */}
          <Card title="Note (Optional)">
            <View style={s.fieldRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.textSecondary} style={s.fieldIcon} />
              <TextInput
                style={s.fieldInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Monthly rent, subscription..."
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          </Card>

          {/* ── Save ── */}
          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <LinearGradient colors={['#7C3AED','#4F46E5']} style={s.saveBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
              <Ionicons name={isEditing ? 'checkmark-done-outline' : 'calendar-number-outline'} size={20} color="#fff" />
              <Text style={s.saveBtnTxt}>{isEditing ? 'Save Changes' : 'Schedule Payment'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Source Pocket Picker ── */}
      <PickerModal
        visible={showPocketPicker}
        title="Select Source Pocket"
        data={pockets}
        selectedId={pocketId}
        onSelect={id => { setPocketId(id); setShowPocketPicker(false); }}
        onClose={() => setShowPocketPicker(false)}
        includeWallet
        onSelectWallet={() => { setPocketId(''); setShowPocketPicker(false); }}
      />

      {/* ── Dest Pocket Picker ── */}
      <PickerModal
        visible={showToPocketPicker}
        title="Select Destination Pocket"
        data={pockets.filter(p => p.id !== pocketId)}
        selectedId={toPocketId}
        onSelect={id => { setToPocketId(id); setShowToPocketPicker(false); }}
        onClose={() => setShowToPocketPicker(false)}
      />

      {/* ── Date Picker ── */}
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={schedDate}
        dates={dateList}
        onSelect={d => { setSchedDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        title="Select Date"
      />

      {/* ── End Date Calendar Picker ── */}
      <CalendarPickerModal
        visible={showEndDatePicker}
        selectedDate={endDate}
        onSelect={d => { setEndDate(d); setShowEndDatePicker(false); }}
        onClose={() => setShowEndDatePicker(false)}
        title="End Date (Optional)"
      />

      {/* ── Time Picker ── */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select Time</Text>
            <View style={s.timeRow}>
              <ScrollView style={s.timeCol} showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <TouchableOpacity key={h} style={[s.timeItem, schedHour===h && s.timeItemActive]} onPress={() => setSchedHour(h)}>
                    <Text style={[s.timeItemTxt, schedHour===h && s.timeItemTxtActive]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.timeSep}>:</Text>
              <ScrollView style={s.timeCol} showsVerticalScrollIndicator={false}>
                {MINS.map(m => (
                  <TouchableOpacity key={m} style={[s.timeItem, schedMin===m && s.timeItemActive]} onPress={() => setSchedMin(m)}>
                    <Text style={[s.timeItemTxt, schedMin===m && s.timeItemTxtActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={s.timePreview}>Set for {schedHour}:{schedMin}</Text>
            <TouchableOpacity style={s.sheetConfirm} onPress={() => setShowTimePicker(false)}>
              <Text style={s.sheetConfirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const Card = ({ title, children }) => (
  <View style={s.card}>
    <Text style={s.cardTitle}>{title}</Text>
    {children}
  </View>
);

const Label = ({ children, style }) => (
  <Text style={[s.label, style]}>{children}</Text>
);

const SRow = ({ icon, label, value }) => (
  <View style={s.sDetailRow}>
    <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
    <Text style={s.sDetailLabel}>{label}</Text>
    <Text style={s.sDetailVal}>{value}</Text>
  </View>
);

const PickerModal = ({ visible, title, data, selectedId, onSelect, onClose, includeWallet, onSelectWallet }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.pickerOverlay}>
      <View style={s.pickerSheet}>
        <View style={s.sheetHandle} />
        <Text style={s.sheetTitle}>{title}</Text>
        <FlatList
          data={data}
          keyExtractor={i => i.id}
          style={{ maxHeight: 320 }}
          ListHeaderComponent={includeWallet ? (
            <TouchableOpacity style={[s.pocketRow, !selectedId && s.pocketRowActive]} onPress={onSelectWallet}>
              <View style={[s.pocketDot, { backgroundColor: '#4F46E5' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.pocketRowName}>Wallet (Main Balance)</Text>
              </View>
              {!selectedId && <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />}
            </TouchableOpacity>
          ) : null}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.pocketRow, selectedId===item.id && s.pocketRowActive]} onPress={() => onSelect(item.id)}>
              <View style={[s.pocketDot, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.pocketRowName}>{item.name}</Text>
                <Text style={s.pocketRowBal}>₹{item.balance.toLocaleString('en-IN')} available</Text>
              </View>
              {selectedId===item.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />}
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={s.sheetCancel} onPress={onClose}>
          <Text style={s.sheetCancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ── Calendar picker (full month grid) ─────────────────────────────────────────
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS   = ['S','M','T','W','T','F','S'];

const CalendarPickerModal = ({ visible, selectedDate, onSelect, onClose, title }) => {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const todayStr = now.toISOString().split('T')[0];

  const goBack = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goForward = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build grid: empty cells + day cells
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells     = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const toDateStr = (day) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.pickerOverlay}>
        <View style={[s.pickerSheet, { maxHeight: '75%' }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{title}</Text>

          {/* Month navigation */}
          <View style={s.calNavRow}>
            <TouchableOpacity style={s.calNavBtn} onPress={goBack}>
              <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={s.calNavTitle}>{CAL_MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={s.calNavBtn} onPress={goForward}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={s.calDowRow}>
            {CAL_DAYS.map((d, i) => (
              <Text key={i} style={s.calDowHdr}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={s.calGrid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={idx} style={s.calCell} />;
              const dateStr   = toDateStr(day);
              const isSelected = dateStr === selectedDate;
              const isToday    = dateStr === todayStr;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[s.calCell, isSelected && s.calCellSelected, isToday && !isSelected && s.calCellToday]}
                  onPress={() => onSelect(dateStr)}
                >
                  <Text style={[s.calCellTxt, isSelected && s.calCellTxtSelected, isToday && !isSelected && { color: COLORS.primary }]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedDate && (
            <TouchableOpacity style={{ alignItems: 'center', paddingBottom: 4 }} onPress={() => onSelect('')}>
              <Text style={{ fontSize: 13, color: COLORS.danger, fontWeight: '600' }}>Clear end date</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.sheetCancel} onPress={onClose}>
            <Text style={s.sheetCancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const DatePickerModal = ({ visible, selectedDate, dates, onSelect, onClose, title }) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.pickerOverlay}>
        <View style={[s.pickerSheet, { maxHeight: '70%' }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{title}</Text>
          <FlatList
            data={dates}
            keyExtractor={d => d}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const [y, m, day] = item.split('-');
              const isToday = item === TODAY;
              const isSelected = item === selectedDate;
              const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(item).getDay()];
              return (
                <TouchableOpacity
                  style={[s.dateRow, isSelected && s.dateRowActive]}
                  onPress={() => onSelect(item)}
                >
                  <View style={[s.dateDayBox, isSelected && s.dateDayBoxActive]}>
                    <Text style={[s.dateDow, isSelected && { color: '#fff' }]}>{dow}</Text>
                    <Text style={[s.dateDay, isSelected && { color: '#fff' }]}>{+day}</Text>
                  </View>
                  <Text style={[s.dateMonthYear, isSelected && { color: COLORS.primary, fontWeight: '700' }]}>
                    {months[+m-1]} {y}
                  </Text>
                  {isToday && <View style={s.todayBadge}><Text style={s.todayBadgeTxt}>Today</Text></View>}
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={s.sheetCancel} onPress={onClose}>
            <Text style={s.sheetCancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  scroll:           { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 60 },
  hero:             { borderRadius: RADIUS.xl, padding: 24, alignItems: 'center', gap: 6, marginBottom: 16, ...SHADOWS.md },
  heroTitle:        { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroSub:          { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  card:             { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, ...SHADOWS.sm },
  cardTitle:        { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  label:            { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  fieldIcon:        {},
  fieldInput:       { flex: 1, fontSize: 15, color: COLORS.text },
  typeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeTile:         { flex: 1, minWidth: '44%', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  typeTileText:     { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  selectorRow:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, padding: 12, gap: 10 },
  selectorRowRequired: { borderColor: COLORS.primary + '66', borderStyle: 'dashed' },
  selectorDot:      { width: 12, height: 12, borderRadius: 6 },
  selectorText:     { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  amtRow:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  rupee:            { fontSize: 24, fontWeight: '700', color: COLORS.textSecondary },
  amtInput:         { flex: 1, fontSize: 32, fontWeight: '800', color: COLORS.text, paddingVertical: 12 },
  quickRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn:         { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#EEF2FF', borderRadius: RADIUS.md },
  quickBtnActive:   { backgroundColor: COLORS.primary },
  quickBtnTxt:      { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  quickBtnTxtActive:{ color: '#fff' },
  recRow:           { gap: 8, paddingVertical: 2 },
  recChip:          { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  recChipActive:    { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' },
  recChipTxt:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  recChipTxtActive: { color: '#7C3AED' },
  saveBtn:          { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: 4 },
  saveBtnGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  saveBtnTxt:       { color: '#fff', fontSize: 17, fontWeight: '800' },
  // Success
  successWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon:      { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...SHADOWS.lg },
  successTitle:     { fontSize: 28, fontWeight: '800', color: COLORS.text },
  successLabel:     { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  successMeta:      { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },
  successDetail:    { width: '100%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 24, gap: 10, ...SHADOWS.sm },
  sDetailRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sDetailLabel:     { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  sDetailVal:       { fontSize: 13, fontWeight: '700', color: COLORS.text },
  doneBtn:          { width: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  doneBtnTxt:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  anotherBtn:       { paddingVertical: 12 },
  anotherBtnTxt:    { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  // Modals
  pickerOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet:      { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  sheetHandle:      { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:       { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  // Calendar picker
  calNavRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 },
  calNavBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  calNavTitle:      { fontSize: 16, fontWeight: '800', color: COLORS.text },
  calDowRow:        { flexDirection: 'row', marginBottom: 6 },
  calDowHdr:        { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  calGrid:          { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  calCell:          { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellSelected:  { backgroundColor: COLORS.primary },
  calCellToday:     { backgroundColor: '#EEF2FF' },
  calCellTxt:       { fontSize: 14, fontWeight: '600', color: COLORS.text },
  calCellTxtSelected: { color: '#fff', fontWeight: '800' },
  sheetCancel:      { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  sheetCancelTxt:   { fontSize: 15, color: COLORS.textSecondary },
  sheetConfirm:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  sheetConfirmTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  pocketRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  pocketRowActive:  { backgroundColor: '#F0FDF4', borderRadius: RADIUS.md, paddingHorizontal: 10 },
  pocketDot:        { width: 12, height: 12, borderRadius: 6 },
  pocketRowName:    { fontSize: 15, fontWeight: '600', color: COLORS.text },
  pocketRowBal:     { fontSize: 12, color: COLORS.textSecondary },
  dateRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dateRowActive:    { backgroundColor: '#EEF2FF', borderRadius: RADIUS.md, paddingHorizontal: 10 },
  dateDayBox:       { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  dateDayBoxActive: { backgroundColor: COLORS.primary },
  dateDow:          { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  dateDay:          { fontSize: 18, fontWeight: '800', color: COLORS.text },
  dateMonthYear:    { flex: 1, fontSize: 15, color: COLORS.text },
  todayBadge:       { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  todayBadgeTxt:    { fontSize: 11, fontWeight: '700', color: COLORS.success },
  timeRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  timeCol:          { maxHeight: 200, width: 72 },
  timeItem:         { paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  timeItemActive:   { backgroundColor: COLORS.primary },
  timeItemTxt:      { fontSize: 22, fontWeight: '700', color: COLORS.textSecondary },
  timeItemTxtActive:{ color: '#fff' },
  timeSep:          { fontSize: 28, fontWeight: '900', color: COLORS.text },
  timePreview:      { textAlign: 'center', fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
});
