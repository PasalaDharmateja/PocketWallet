/**
 * PaymentScreen.js — PocketWallet
 *
 * Handles all 4 payment flows with real UPI integration:
 *  upi-qr    → Camera QR scanner → parse VPA → UPI deep link
 *  upi-phone → Phone → candidate VPAs → UPI deep link
 *  upi-id    → Enter/validate VPA → choose installed UPI app → deep link
 *  razorpay  → Razorpay Standard Checkout (all methods)
 *  bank      → Account + IFSC (NEFT/RTGS, processed via your backend)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, FlatList, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useWallet } from '../context/WalletContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';
import {
  validateVPA, validateIFSC, phoneToVPACandidates,
  buildUPIUrl, genTxRef, openUPIApp, getInstalledUPIApps,
  parseUPIQR, openRazorpayCheckout, bankFromVPA, TX_STATUS, UPI_APPS,
} from '../services/UPIService';

// ── Screen config per payment type ────────────────────────────────────────────
const CONFIGS = {
  'upi-qr':    { title: 'Scan QR Code',       icon: 'qr-code-outline',   gradient: ['#7C3AED', '#EC4899'] },
  'upi-phone': { title: 'UPI Phone Number',    icon: 'call-outline',      gradient: ['#2563EB', '#06B6D4'] },
  'upi-id':    { title: 'Pay via UPI ID',      icon: 'at-circle-outline', gradient: ['#4F46E5', '#7C3AED'] },
  'razorpay':  { title: 'Pay with Razorpay',   icon: 'card-outline',      gradient: ['#0EA5E9', '#4F46E5'] },
  'bank':      { title: 'Bank Transfer',       icon: 'business-outline',  gradient: ['#059669', '#10B981'] },
};

export default function PaymentScreen({ route, navigation }) {
  const { pocketId, paymentType } = route.params;
  const { pockets, sendUpiPayment, sendBankTransfer } = useWallet();
  const pocket = pockets.find(p => p.id === pocketId);
  const cfg = CONFIGS[paymentType] || CONFIGS['upi-id'];

  // ── Form state ─────────────────────────────────────────────────────────────
  const [amount, setAmount]       = useState('');
  const [upiId,  setUpiId]        = useState('');
  const [phone,  setPhone]        = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc]           = useState('');
  const [note, setNote]           = useState('');
  const [vpaError, setVpaError]   = useState('');
  const [ifscError, setIfscError] = useState('');

  // ── UPI deep-link flow ─────────────────────────────────────────────────────
  const [installedApps, setInstalledApps]   = useState(UPI_APPS);
  const [showAppPicker, setShowAppPicker]   = useState(false);
  const [selectedApp,   setSelectedApp]     = useState(null);
  const [pendingUPIUrl, setPendingUPIUrl]   = useState(null);

  // ── QR scanner ─────────────────────────────────────────────────────────────
  const [showCamera,  setShowCamera]        = useState(false);
  const [cameraPerms, requestCameraPerms]   = useCameraPermissions();
  const [scannedVPA,  setScannedVPA]        = useState(null);
  const scannedRef = useRef(false);

  // ── Phone → VPA candidates ─────────────────────────────────────────────────
  const [vpaCandidates,  setVpaCandidates]  = useState([]);
  const [chosenVPA,      setChosenVPA]      = useState('');
  const [showVPAPicker,  setShowVPAPicker]  = useState(false);

  // ── General status ─────────────────────────────────────────────────────────
  const [loading,     setLoading]           = useState(false);
  const [txStatus,    setTxStatus]          = useState(TX_STATUS.IDLE);
  const [txRef,       setTxRef]             = useState('');
  const [paymentId,   setPaymentId]         = useState('');
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getInstalledUPIApps().then(setInstalledApps);
  }, []);

  if (!pocket) { navigation.goBack(); return null; }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const amtNum = parseFloat(amount) || 0;

  const validateAmount = () => {
    if (!amtNum || amtNum <= 0) { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return false; }
    if (amtNum > pocket.balance) { Alert.alert('Insufficient Balance', `Max: ₹${pocket.balance.toLocaleString('en-IN')}`); return false; }
    return true;
  };

  const resetForm = () => {
    setAmount(''); setUpiId(''); setPhone(''); setAccountNo(''); setIfsc(''); setNote('');
    setVpaError(''); setIfscError(''); setScannedVPA(null); setChosenVPA('');
    setTxStatus(TX_STATUS.IDLE); setTxRef(''); setPaymentId('');
    scannedRef.current = false;
  };

  const animateSuccess = () => {
    Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
  };

  // ── QR scan handler ────────────────────────────────────────────────────────
  const handleQRScanned = ({ data }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parsed = parseUPIQR(data);
    if (!parsed || !parsed.payeeVpa) {
      Alert.alert('Invalid QR', 'This QR code is not a valid UPI payment QR.', [
        { text: 'Scan Again', onPress: () => { scannedRef.current = false; } },
        { text: 'Cancel', onPress: () => setShowCamera(false) },
      ]);
      return;
    }
    setScannedVPA(parsed);
    if (parsed.amount) setAmount(String(parsed.amount));
    if (parsed.note)   setNote(parsed.note);
    setShowCamera(false);
  };

  const openCamera = async () => {
    if (!cameraPerms?.granted) {
      const res = await requestCameraPerms();
      if (!res.granted) { Alert.alert('Camera Permission Required', 'Allow camera access to scan QR codes.'); return; }
    }
    scannedRef.current = false;
    setShowCamera(true);
  };

  // ── Phone → VPA candidates ─────────────────────────────────────────────────
  const handlePhoneLookup = () => {
    if (phone.length !== 10) { Alert.alert('Invalid Number', 'Enter a valid 10-digit mobile number.'); return; }
    const candidates = phoneToVPACandidates(phone);
    setVpaCandidates(candidates);
    setShowVPAPicker(true);
  };

  // ── Core pay dispatcher ────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!validateAmount()) return;

    // ── Razorpay checkout ──────────────────────────────────────────────────
    if (paymentType === 'razorpay') {
      setLoading(true);
      const result = await openRazorpayCheckout({
        amount: amtNum,
        description: note || `Payment from ${pocket.name}`,
        prefillVpa: upiId,
      });
      setLoading(false);
      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        sendUpiPayment(pocketId, amtNum, 'Razorpay', note, 'razorpay');
        setPaymentId(result.paymentId || '');
        setTxStatus(TX_STATUS.SUCCESS);
        animateSuccess();
      } else if (!result.cancelled) {
        Alert.alert('Payment Failed', result.error || 'Something went wrong. Please try again.');
      }
      return;
    }

    // ── Bank transfer ──────────────────────────────────────────────────────
    if (paymentType === 'bank') {
      if (!accountNo.trim()) { Alert.alert('Account Number Required'); return; }
      const iResult = validateIFSC(ifsc);
      if (!iResult.valid) { setIfscError(iResult.error); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sendBankTransfer(pocketId, amtNum, accountNo, ifsc, note);
      setTxRef(genTxRef());
      setTxStatus(TX_STATUS.SUCCESS);
      animateSuccess();
      return;
    }

    // ── UPI deep-link flows ────────────────────────────────────────────────
    let finalVPA = '';

    if (paymentType === 'upi-id') {
      const v = validateVPA(upiId);
      if (!v.valid) { setVpaError(v.error); return; }
      finalVPA = v.vpa;
    } else if (paymentType === 'upi-phone') {
      if (!chosenVPA) { Alert.alert('Select a UPI handle', 'Tap "Find UPI ID" first.'); return; }
      finalVPA = chosenVPA;
    } else if (paymentType === 'upi-qr') {
      if (!scannedVPA?.payeeVpa) { Alert.alert('Scan QR First', 'Tap the scanner to scan a UPI QR code.'); return; }
      finalVPA = scannedVPA.payeeVpa;
    }

    const ref = genTxRef();
    const upiUrl = buildUPIUrl({
      payeeVpa:  finalVPA,
      payeeName: scannedVPA?.payeeName || finalVPA.split('@')[0],
      amount:    amtNum,
      txRef:     ref,
      note:      note || `PocketWallet - ${pocket.name}`,
    });

    setPendingUPIUrl(upiUrl);
    setTxRef(ref);
    setShowAppPicker(true);
  };

  // ── After user picks a UPI app ─────────────────────────────────────────────
  const launchUPIApp = async (appId) => {
    setShowAppPicker(false);
    setLoading(true);

    const result = await openUPIApp(pendingUPIUrl, appId);
    setLoading(false);

    if (!result.ok) {
      Alert.alert('Cannot Open App', result.error, [{ text: 'OK' }]);
      return;
    }

    // Record transaction optimistically (UPI deep-link gives no callback)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const vpa = paymentType === 'upi-id'    ? upiId
              : paymentType === 'upi-phone' ? chosenVPA
              : scannedVPA?.payeeVpa || 'QR';
    sendUpiPayment(pocketId, amtNum, vpa, note, paymentType);
    setPaymentId('');
    setTxStatus(TX_STATUS.SUCCESS);
    animateSuccess();
  };

  // ── SUCCESS screen ─────────────────────────────────────────────────────────
  if (txStatus === TX_STATUS.SUCCESS) {
    const bank = bankFromVPA(
      paymentType === 'upi-id'    ? upiId
      : paymentType === 'upi-phone' ? chosenVPA
      : scannedVPA?.payeeVpa || ''
    );
    const scale = successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.successWrap}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient colors={cfg.gradient} style={s.successIcon}>
              <Ionicons name="checkmark" size={52} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={s.successTitle}>Payment Sent!</Text>
          <Text style={s.successAmt}>₹{amtNum.toLocaleString('en-IN')}</Text>
          <Text style={s.successFrom}>from <Text style={{ fontWeight: '800' }}>{pocket.name}</Text></Text>

          <View style={s.successCard}>
            <Row label="Method"    value={cfg.title} />
            {paymentType !== 'bank' && paymentType !== 'razorpay' && (
              <Row label="To (UPI)"  value={
                paymentType === 'upi-id'    ? upiId
                : paymentType === 'upi-phone' ? chosenVPA
                : scannedVPA?.payeeVpa || 'QR'
              } />
            )}
            {bank && <Row label="Bank" value={bank} />}
            {note  ? <Row label="Note" value={note} /> : null}
            {txRef  ? <Row label="Ref No." value={txRef} last /> : null}
            {paymentId ? <Row label="Payment ID" value={paymentId} last /> : null}
            <Row label="Status"   value="✅  Completed" />
          </View>

          {txRef && (
            <TouchableOpacity style={s.copyBtn} onPress={async () => {
              await Clipboard.setStringAsync(txRef);
              Alert.alert('Copied', 'Transaction reference copied.');
            }}>
              <Ionicons name="copy-outline" size={15} color={COLORS.primary} />
              <Text style={s.copyBtnText}>Copy reference</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.navigate('Tabs')}>
            <Text style={s.doneBtnTxt}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.againBtn} onPress={resetForm}>
            <Text style={s.againBtnTxt}>Make another payment</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── MAIN form ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <LinearGradient colors={cfg.gradient} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name={cfg.icon} size={34} color="#fff" />
            <Text style={s.heroTitle}>{cfg.title}</Text>
            <Text style={s.heroPocket}>From: {pocket.name}</Text>
            <Text style={s.heroBalance}>Available  ₹{pocket.balance.toLocaleString('en-IN')}</Text>
          </LinearGradient>

          {/* ── QR SCANNER ── */}
          {paymentType === 'upi-qr' && (
            <View style={s.card}>
              {scannedVPA ? (
                <View style={s.scannedRow}>
                  <View style={s.scannedInfo}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                    <View>
                      <Text style={s.scannedVPA}>{scannedVPA.payeeVpa}</Text>
                      {scannedVPA.payeeName ? <Text style={s.scannedName}>{scannedVPA.payeeName}</Text> : null}
                      {bankFromVPA(scannedVPA.payeeVpa) && (
                        <Text style={s.scannedBank}>{bankFromVPA(scannedVPA.payeeVpa)}</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => { setScannedVPA(null); scannedRef.current = false; }}>
                    <Ionicons name="refresh-outline" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.qrScanner} onPress={openCamera}>
                  <View style={s.qrFrame}>
                    {['TL','TR','BL','BR'].map(p => <View key={p} style={[s.qrCorner, s[`qr${p}`]]} />)}
                    <Ionicons name="scan-outline" size={56} color="#A5B4FC" />
                  </View>
                  <Text style={s.qrHint}>Tap to open camera and scan QR</Text>
                  <View style={s.qrChip}>
                    <Ionicons name="camera-outline" size={14} color={COLORS.primary} />
                    <Text style={s.qrChipText}>Open Camera</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── UPI ID ── */}
          {paymentType === 'upi-id' && (
            <View style={s.card}>
              <Label>UPI ID</Label>
              <View style={[s.fieldRow, vpaError && s.fieldRowError]}>
                <Ionicons name="at-circle-outline" size={20} color={COLORS.textSecondary} style={s.fieldIcon} />
                <TextInput
                  style={s.fieldInput} autoCapitalize="none" autoCorrect={false}
                  placeholder="username@okaxis" placeholderTextColor={COLORS.textLight}
                  value={upiId} onChangeText={v => { setUpiId(v); setVpaError(''); }}
                />
                {upiId ? (
                  <TouchableOpacity onPress={() => {
                    const v = validateVPA(upiId);
                    if (!v.valid) setVpaError(v.error);
                    else setVpaError('✓ Valid UPI ID');
                  }}>
                    <Text style={s.verifyText}>Verify</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {vpaError ? (
                <Text style={[s.helperText, vpaError.startsWith('✓') && s.helperSuccess]}>{vpaError}</Text>
              ) : null}
              {upiId && bankFromVPA(upiId) ? (
                <Text style={s.bankHint}>🏦 {bankFromVPA(upiId)}</Text>
              ) : null}
              <TouchableOpacity style={s.pasteBtn} onPress={async () => {
                const clip = await Clipboard.getStringAsync();
                if (clip) setUpiId(clip.trim());
              }}>
                <Ionicons name="clipboard-outline" size={14} color={COLORS.primary} />
                <Text style={s.pasteBtnText}>Paste from clipboard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── UPI PHONE ── */}
          {paymentType === 'upi-phone' && (
            <View style={s.card}>
              <Label>Mobile Number</Label>
              <View style={s.phoneRow}>
                <View style={s.countryCode}><Text style={s.countryCodeText}>🇮🇳 +91</Text></View>
                <TextInput
                  style={s.phoneInput} keyboardType="phone-pad" maxLength={10}
                  placeholder="9876543210" placeholderTextColor={COLORS.textLight}
                  value={phone} onChangeText={setPhone}
                />
              </View>
              <TouchableOpacity style={[s.lookupBtn, phone.length !== 10 && s.lookupBtnDisabled]} onPress={handlePhoneLookup} disabled={phone.length !== 10}>
                <Ionicons name="search-outline" size={16} color={phone.length === 10 ? COLORS.primary : COLORS.textLight} />
                <Text style={[s.lookupBtnText, phone.length !== 10 && { color: COLORS.textLight }]}>Find UPI ID</Text>
              </TouchableOpacity>
              {chosenVPA ? (
                <View style={s.chosenVPARow}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={s.chosenVPAText}>{chosenVPA}</Text>
                  <TouchableOpacity onPress={() => setChosenVPA('')}>
                    <Ionicons name="close-circle-outline" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {/* ── BANK TRANSFER ── */}
          {paymentType === 'bank' && (
            <View style={s.card}>
              <Label>Account Number</Label>
              <View style={s.fieldRow}>
                <Ionicons name="card-outline" size={20} color={COLORS.textSecondary} style={s.fieldIcon} />
                <TextInput style={s.fieldInput} keyboardType="numeric" placeholder="1234567890123"
                  placeholderTextColor={COLORS.textLight} value={accountNo} onChangeText={setAccountNo} />
              </View>
              <Label style={{ marginTop: 14 }}>IFSC Code</Label>
              <View style={[s.fieldRow, ifscError && s.fieldRowError]}>
                <Ionicons name="code-outline" size={20} color={COLORS.textSecondary} style={s.fieldIcon} />
                <TextInput style={s.fieldInput} autoCapitalize="characters" maxLength={11} placeholder="ABCD0123456"
                  placeholderTextColor={COLORS.textLight} value={ifsc}
                  onChangeText={v => { setIfsc(v.toUpperCase()); setIfscError(''); }} />
              </View>
              {ifscError ? <Text style={s.helperText}>{ifscError}</Text> : null}
            </View>
          )}

          {/* ── RAZORPAY ── */}
          {paymentType === 'razorpay' && (
            <View style={s.card}>
              <Label>Optional — Pre-fill UPI ID</Label>
              <View style={s.fieldRow}>
                <Ionicons name="at-circle-outline" size={20} color={COLORS.textSecondary} style={s.fieldIcon} />
                <TextInput style={s.fieldInput} autoCapitalize="none"
                  placeholder="username@okaxis (optional)" placeholderTextColor={COLORS.textLight}
                  value={upiId} onChangeText={setUpiId} />
              </View>
              <View style={s.razorpayBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.success} />
                <Text style={s.razorpayBadgeText}>Razorpay Secure Checkout · Cards · UPI · Wallets · Netbanking</Text>
              </View>
            </View>
          )}

          {/* ── AMOUNT + NOTE ── */}
          <View style={s.card}>
            <Label>Amount</Label>
            <View style={s.amtRow}>
              <Text style={s.rupee}>₹</Text>
              <TextInput style={s.amtInput} keyboardType="numeric" value={amount}
                onChangeText={setAmount} placeholder="0" placeholderTextColor={COLORS.textLight} />
              {amtNum > 0 && <Text style={s.amtHint}>Max ₹{pocket.balance.toLocaleString('en-IN')}</Text>}
            </View>

            {/* Quick amounts */}
            <View style={s.quickRow}>
              {[100, 500, 1000, 2000, 5000].map(a => (
                <TouchableOpacity key={a} style={[s.quickBtn, amtNum === a && s.quickBtnActive]} onPress={() => setAmount(String(a))}>
                  <Text style={[s.quickBtnText, amtNum === a && s.quickBtnTextActive]}>₹{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Label style={{ marginTop: 14 }}>Remark (Optional)</Label>
            <View style={s.fieldRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.textSecondary} style={s.fieldIcon} />
              <TextInput style={s.fieldInput} value={note} onChangeText={setNote}
                placeholder="What's this for?" placeholderTextColor={COLORS.textLight} />
            </View>
          </View>

          {/* ── PAY BUTTON ── */}
          <TouchableOpacity style={s.payBtn} onPress={handlePay} disabled={loading}>
            <LinearGradient colors={cfg.gradient} style={s.payBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name={paymentType === 'bank' ? 'swap-horizontal-outline' : 'send-outline'} size={20} color="#fff" />
                    <Text style={s.payBtnText}>
                      {amtNum > 0 ? `Pay ₹${amtNum.toLocaleString('en-IN')}` : paymentType === 'bank' ? 'Transfer' : 'Pay Now'}
                    </Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── CAMERA MODAL ── */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <View style={s.cameraWrap}>
          <CameraView style={s.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleQRScanned} />
          <View style={s.cameraOverlay}>
            <View style={s.cameraFrame}>
              {['TL','TR','BL','BR'].map(p => <View key={p} style={[s.camCorner, s[`cam${p}`]]} />)}
            </View>
            <Text style={s.cameraHint}>Align UPI QR code within the frame</Text>
          </View>
          <TouchableOpacity style={s.cameraClose} onPress={() => setShowCamera(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── UPI APP PICKER ── */}
      <Modal visible={showAppPicker} animationType="slide" transparent onRequestClose={() => setShowAppPicker(false)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Choose UPI App</Text>
            <Text style={s.pickerAmt}>Paying ₹{amtNum.toLocaleString('en-IN')}</Text>
            <FlatList
              data={installedApps}
              keyExtractor={a => a.id}
              numColumns={3}
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.appTile} onPress={() => launchUPIApp(item.id)}>
                  <View style={[s.appIconBox, { backgroundColor: item.color + '22' }]}>
                    <Text style={s.appInitial}>{item.name[0]}</Text>
                  </View>
                  <Text style={s.appName} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.anyAppBtn} onPress={() => launchUPIApp(null)}>
              <Text style={s.anyAppText}>Let me choose from installed apps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAppPicker(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── VPA PICKER (phone flow) ── */}
      <Modal visible={showVPAPicker} animationType="slide" transparent onRequestClose={() => setShowVPAPicker(false)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Select UPI Handle</Text>
            <Text style={s.pickerSub}>Pick the handle registered with {phone}</Text>
            {vpaCandidates.map(vpa => (
              <TouchableOpacity key={vpa} style={[s.vpaRow, chosenVPA === vpa && s.vpaRowActive]} onPress={() => { setChosenVPA(vpa); setShowVPAPicker(false); }}>
                <Ionicons name="at-circle-outline" size={20} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.vpaRowText}>{vpa}</Text>
                  {bankFromVPA(vpa) ? <Text style={s.vpaRowBank}>{bankFromVPA(vpa)}</Text> : null}
                </View>
                {chosenVPA === vpa && <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowVPAPicker(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────
const Label = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;
const Row = ({ label, value }) => (
  <View style={s.detailRow}>
    <Text style={s.detailLabel}>{label}</Text>
    <Text style={s.detailVal} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
  </View>
);

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: COLORS.background },
  scroll:            { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 50 },
  hero:              { borderRadius: RADIUS.xl, padding: 24, alignItems: 'center', gap: 6, marginBottom: 16, ...SHADOWS.md },
  heroTitle:         { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroPocket:        { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  heroBalance:       { fontSize: 14, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  card:              { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, ...SHADOWS.sm },
  label:             { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  fieldRow:          { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  fieldRowError:     { borderColor: COLORS.danger },
  fieldIcon:         { },
  fieldInput:        { flex: 1, fontSize: 15, color: COLORS.text },
  helperText:        { fontSize: 12, color: COLORS.danger, marginTop: 5 },
  helperSuccess:     { color: COLORS.success },
  bankHint:          { fontSize: 12, color: COLORS.textSecondary, marginTop: 5 },
  verifyText:        { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  pasteBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start', backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pasteBtnText:      { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  phoneRow:          { flexDirection: 'row', gap: 10, alignItems: 'center' },
  countryCode:       { backgroundColor: '#F1F5F9', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  countryCodeText:   { fontSize: 14, fontWeight: '600', color: COLORS.text },
  phoneInput:        { flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontWeight: '600', color: COLORS.text, letterSpacing: 1 },
  lookupBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start', borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 },
  lookupBtnDisabled: { borderColor: '#E2E8F0' },
  lookupBtnText:     { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  chosenVPARow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#F0FDF4', padding: 10, borderRadius: RADIUS.md },
  chosenVPAText:     { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.success },
  razorpayBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#F0FDF4', padding: 10, borderRadius: RADIUS.md },
  razorpayBadgeText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  amtRow:            { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: RADIUS.md, paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  rupee:             { fontSize: 24, fontWeight: '700', color: COLORS.textSecondary },
  amtInput:          { flex: 1, fontSize: 32, fontWeight: '800', color: COLORS.text, paddingVertical: 12 },
  amtHint:           { fontSize: 11, color: COLORS.textLight },
  quickRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn:          { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#EEF2FF', borderRadius: RADIUS.md },
  quickBtnActive:    { backgroundColor: COLORS.primary },
  quickBtnText:      { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  quickBtnTextActive:{ color: '#fff' },
  payBtn:            { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: 4 },
  payBtnGrad:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  payBtnText:        { color: '#fff', fontSize: 17, fontWeight: '800' },
  // QR
  qrScanner:         { alignItems: 'center', gap: 12, paddingVertical: 8 },
  qrFrame:           { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, position: 'relative' },
  qrCorner:          { position: 'absolute', width: 28, height: 28, borderColor: COLORS.primary, borderWidth: 3 },
  qrTL:              { top: 8, left: 8, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  qrTR:              { top: 8, right: 8, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  qrBL:              { bottom: 8, left: 8, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  qrBR:              { bottom: 8, right: 8, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  qrHint:            { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  qrChip:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  qrChipText:        { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  scannedRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scannedInfo:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  scannedVPA:        { fontSize: 15, fontWeight: '700', color: COLORS.text },
  scannedName:       { fontSize: 12, color: COLORS.textSecondary },
  scannedBank:       { fontSize: 11, color: COLORS.textLight },
  // Camera
  cameraWrap:        { flex: 1, backgroundColor: '#000' },
  camera:            { flex: 1 },
  cameraOverlay:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cameraFrame:       { width: 260, height: 260, position: 'relative' },
  camCorner:         { position: 'absolute', width: 36, height: 36, borderColor: '#fff', borderWidth: 3 },
  camTL:             { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  camTR:             { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  camBL:             { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  camBR:             { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  cameraHint:        { color: '#fff', marginTop: 24, fontSize: 13, textAlign: 'center' },
  cameraClose:       { position: 'absolute', top: 52, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  // App picker
  pickerOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet:       { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  pickerHandle:      { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  pickerTitle:       { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  pickerAmt:         { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  pickerSub:         { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  appTile:           { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12 },
  appIconBox:        { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  appInitial:        { fontSize: 26, fontWeight: '800', color: COLORS.text },
  appName:           { fontSize: 12, fontWeight: '500', color: COLORS.text },
  anyAppBtn:         { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8 },
  anyAppText:        { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  cancelBtn:         { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText:     { fontSize: 15, color: COLORS.textSecondary },
  vpaRow:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  vpaRowActive:      { backgroundColor: '#F0FDF4', borderRadius: RADIUS.md, paddingHorizontal: 10 },
  vpaRowText:        { fontSize: 14, fontWeight: '600', color: COLORS.text },
  vpaRowBank:        { fontSize: 11, color: COLORS.textSecondary },
  // Success
  successWrap:       { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, paddingTop: 60 },
  successIcon:       { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 24, ...SHADOWS.lg },
  successTitle:      { fontSize: 28, fontWeight: '800', color: COLORS.text },
  successAmt:        { fontSize: 48, fontWeight: '900', color: COLORS.text, letterSpacing: -2, marginTop: 4 },
  successFrom:       { fontSize: 15, color: COLORS.textSecondary, marginBottom: 28 },
  successCard:       { width: '100%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 18, marginBottom: 20, ...SHADOWS.sm, gap: 12 },
  detailRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel:       { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  detailVal:         { fontSize: 13, fontWeight: '700', color: COLORS.text, flex: 2, textAlign: 'right' },
  copyBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
  copyBtnText:       { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  doneBtn:           { width: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  doneBtnTxt:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  againBtn:          { paddingVertical: 12 },
  againBtnTxt:       { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});
