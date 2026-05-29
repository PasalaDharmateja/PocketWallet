/**
 * RegisterScreen.js
 * 3-step first-install onboarding:
 *   Step 1 — Name + Email + Phone
 *   Step 2 — Create Password
 *   Step 3 — Confirm + Terms
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth, validatePassword, validateEmail, validatePhone } from '../context/AuthContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../utils/theme';

const STEPS = [
  { icon: 'person-outline',    title: 'Create Account',   sub: 'Set up your PocketWallet' },
  { icon: 'lock-closed-outline',title: 'Secure Password', sub: 'Keep your money safe'      },
  { icon: 'checkmark-circle-outline', title: "You're All Set!", sub: 'Review and confirm'  },
];

export default function RegisterScreen() {
  const { register, authError, setAuthError } = useAuth();

  const [step,       setStep]       = useState(0);
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [phone,      setPhone]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fieldErr,   setFieldErr]   = useState({});

  const slideAnim = useRef(new Animated.Value(0)).current;

  const slideToStep = (next) => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0,   duration: 250, useNativeDriver: true }),
    ]).start();
    setStep(next);
    setAuthError('');
    setFieldErr({});
  };

  const pwChecks = validatePassword(password);
  const pwStrength = pwChecks.length === 0 ? 'strong' : pwChecks.length === 1 ? 'medium' : 'weak';

  // ── Step validation ────────────────────────────────────────────────────────
  const validateStep0 = () => {
    const errs = {};
    if (!name.trim())          errs.name  = 'Full name is required';
    if (!validateEmail(email)) errs.email = 'Enter a valid email';
    if (!validatePhone(phone)) errs.phone = 'Enter a valid 10-digit mobile number';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep1 = () => {
    const errs = {};
    if (pwChecks.length > 0)     errs.password = pwChecks[0];
    if (password !== confirm)    errs.confirm  = 'Passwords do not match';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step < 2) slideToStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) slideToStep(step - 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await register({ name, email, phone, password });
    setLoading(false);
  };

  const progress = (step + 1) / 3;

  return (
    <LinearGradient colors={['#0D0D1A', '#151528', '#1A1A35']} style={s.bg}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back button */}
            {step > 0 && (
              <TouchableOpacity style={s.backBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}

            {/* Logo */}
            <View style={s.logoRow}>
              <LinearGradient colors={['#6C63FF','#EC4899']} style={s.logoBox}>
                <Ionicons name="wallet-outline" size={28} color="#fff" />
              </LinearGradient>
              <Text style={s.logoText}>PocketWallet</Text>
            </View>

            {/* Progress bar */}
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <Animated.View style={[s.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={s.progressTxt}>Step {step + 1} of 3</Text>
            </View>

            {/* Step header */}
            <Animated.View style={[s.stepHeader, { transform: [{ translateX: slideAnim }] }]}>
              <View style={s.stepIconWrap}>
                <Ionicons name={STEPS[step].icon} size={32} color="#fff" />
              </View>
              <Text style={s.stepTitle}>{STEPS[step].title}</Text>
              <Text style={s.stepSub}>{STEPS[step].sub}</Text>
            </Animated.View>

            {/* ── STEP 0: Personal Info ── */}
            {step === 0 && (
              <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
                <Field
                  label="Full Name"
                  icon="person-outline"
                  value={name}
                  onChangeText={t => { setName(t); setFieldErr(p => ({...p, name: ''})); }}
                  placeholder="Raj Sharma"
                  error={fieldErr.name}
                  autoCapitalize="words"
                />
                <Field
                  label="Email Address"
                  icon="mail-outline"
                  value={email}
                  onChangeText={t => { setEmail(t); setFieldErr(p => ({...p, email: ''})); }}
                  placeholder="raj@example.com"
                  error={fieldErr.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Mobile Number"
                  icon="call-outline"
                  value={phone}
                  onChangeText={t => { setPhone(t.replace(/\D/g,'')); setFieldErr(p => ({...p, phone: ''})); }}
                  placeholder="9876543210"
                  error={fieldErr.phone}
                  keyboardType="phone-pad"
                  prefix="+91"
                  maxLength={10}
                />
              </Animated.View>
            )}

            {/* ── STEP 1: Password ── */}
            {step === 1 && (
              <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
                <Field
                  label="Create Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={t => { setPassword(t); setFieldErr(p => ({...p, password: ''})); }}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  secureTextEntry={!showPass}
                  error={fieldErr.password}
                  rightIcon={showPass ? 'eye-off-outline' : 'eye-outline'}
                  onRightIcon={() => setShowPass(v => !v)}
                />

                {/* Strength meter */}
                {password.length > 0 && (
                  <View style={s.strengthWrap}>
                    <View style={s.strengthBars}>
                      {[0,1,2].map(i => (
                        <View key={i} style={[s.strengthBar,
                          pwStrength === 'weak'   && i === 0 && { backgroundColor: '#EF4444' },
                          pwStrength === 'medium' && i < 2   && { backgroundColor: '#F59E0B' },
                          pwStrength === 'strong'             && { backgroundColor: '#10B981' },
                        ]} />
                      ))}
                    </View>
                    <Text style={[s.strengthLabel,
                      { color: pwStrength === 'strong' ? '#10B981' : pwStrength === 'medium' ? '#F59E0B' : '#EF4444' }
                    ]}>
                      {pwStrength.charAt(0).toUpperCase() + pwStrength.slice(1)}
                    </Text>
                  </View>
                )}

                {/* Checklist */}
                <View style={s.checkList}>
                  {[
                    { text: 'At least 8 characters', ok: password.length >= 8 },
                    { text: 'One uppercase letter',   ok: /[A-Z]/.test(password) },
                    { text: 'One number',             ok: /[0-9]/.test(password) },
                  ].map((c, i) => (
                    <View key={i} style={s.checkRow}>
                      <Ionicons
                        name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
                        size={15}
                        color={c.ok ? '#10B981' : 'rgba(255,255,255,0.25)'}
                      />
                      <Text style={[s.checkText, c.ok && { color: '#10B981' }]}>{c.text}</Text>
                    </View>
                  ))}
                </View>

                <Field
                  label="Confirm Password"
                  icon="lock-closed-outline"
                  value={confirm}
                  onChangeText={t => { setConfirm(t); setFieldErr(p => ({...p, confirm: ''})); }}
                  placeholder="Re-enter your password"
                  secureTextEntry={!showConf}
                  error={fieldErr.confirm}
                  rightIcon={showConf ? 'eye-off-outline' : 'eye-outline'}
                  onRightIcon={() => setShowConf(v => !v)}
                  success={confirm.length > 0 && confirm === password}
                />
              </Animated.View>
            )}

            {/* ── STEP 2: Summary ── */}
            {step === 2 && (
              <Animated.View style={[s.summary, { transform: [{ translateX: slideAnim }] }]}>
                <SummaryRow icon="person-circle-outline" label="Name"   value={name} />
                <SummaryRow icon="mail-outline"          label="Email"  value={email} />
                <SummaryRow icon="call-outline"          label="Mobile" value={`+91 ${phone}`} />
                <SummaryRow icon="lock-closed-outline"   label="Password" value="••••••••" />
                <View style={s.nextStep}>
                  <Ionicons name="keypad-outline" size={18} color={COLORS.primary} />
                  <Text style={s.nextStepTxt}>Next: Create your 4-digit PIN</Text>
                </View>
                {authError ? (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
                    <Text style={s.errBoxTxt}>{authError}</Text>
                  </View>
                ) : null}
              </Animated.View>
            )}

            {/* CTA Button */}
            <TouchableOpacity style={s.ctaBtn} onPress={step < 2 ? handleNext : handleCreate} disabled={loading}>
              <LinearGradient colors={['#6C63FF','#EC4899']} style={s.ctaGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                {loading ? (
                  <Text style={s.ctaTxt}>Creating Account…</Text>
                ) : (
                  <>
                    <Text style={s.ctaTxt}>{step < 2 ? 'Continue' : 'Create Account'}</Text>
                    <Ionicons name={step < 2 ? 'arrow-forward' : 'checkmark'} size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Step dots */}
            <View style={s.dots}>
              {[0,1,2].map(i => (
                <View key={i} style={[s.dot, step === i && s.dotActive]} />
              ))}
            </View>

            {/* Footer note */}
            <Text style={s.footerNote}>
              Already have an account?{' '}
              <Text style={s.footerLink} onPress={() => {}}>Sign In</Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Field({ label, icon, value, onChangeText, placeholder, secureTextEntry, error, rightIcon, onRightIcon, keyboardType, autoCapitalize, prefix, maxLength, success }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.fieldRow, error && s.fieldRowErr, success && s.fieldRowOk]}>
        <Ionicons name={icon} size={18} color={error ? '#FCA5A5' : success ? '#10B981' : 'rgba(255,255,255,0.4)'} style={s.fieldIcon} />
        {prefix && <Text style={s.fieldPrefix}>{prefix}</Text>}
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.2)"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          maxLength={maxLength}
          selectionColor="#6C63FF"
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIcon} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name={rightIcon} size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
        {success && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
      </View>
      {error ? <Text style={s.fieldErr}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({ icon, label, value }) {
  return (
    <View style={s.sumRow}>
      <View style={s.sumIconWrap}><Ionicons name={icon} size={18} color={COLORS.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.sumLabel}>{label}</Text>
        <Text style={s.sumValue}>{value}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
    </View>
  );
}

const s = StyleSheet.create({
  bg:             { flex: 1 },
  scroll:         { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 4 },
  logoRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 24 },
  logoBox:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText:       { fontSize: 20, fontWeight: '800', color: '#fff' },
  progressWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  progressBg:     { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: '#6C63FF', borderRadius: 2 },
  progressTxt:    { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  stepHeader:     { alignItems: 'center', marginBottom: 32, gap: 8 },
  stepIconWrap:   { width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(108,99,255,0.2)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepTitle:      { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  stepSub:        { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  // Field
  fieldWrap:      { marginBottom: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  fieldRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  fieldRowErr:    { borderColor: '#EF444460', backgroundColor: 'rgba(239,68,68,0.06)' },
  fieldRowOk:     { borderColor: '#10B98160' },
  fieldIcon:      {},
  fieldPrefix:    { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginRight: -4 },
  input:          { flex: 1, fontSize: 15, color: '#fff', fontFamily: Platform.select({ ios: 'System', android: 'Roboto', web: 'inherit' }) },
  fieldErr:       { fontSize: 11, color: '#FCA5A5', marginTop: 5, marginLeft: 4 },
  // Password strength
  strengthWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8, marginBottom: 12 },
  strengthBars:   { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar:    { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  strengthLabel:  { fontSize: 11, fontWeight: '700', width: 52, textAlign: 'right' },
  checkList:      { gap: 6, marginBottom: 20, paddingLeft: 4 },
  checkRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText:      { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  // Summary
  summary:        { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16, gap: 2 },
  sumRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sumIconWrap:    { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(108,99,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  sumLabel:       { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' },
  sumValue:       { fontSize: 14, fontWeight: '600', color: '#fff' },
  nextStep:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12 },
  nextStepTxt:    { fontSize: 13, color: 'rgba(108,99,255,0.9)', fontWeight: '600' },
  errBox:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginTop: 10 },
  errBoxTxt:      { flex: 1, fontSize: 13, color: '#FCA5A5' },
  // CTA
  ctaBtn:         { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  ctaGrad:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  ctaTxt:         { fontSize: 17, fontWeight: '800', color: '#fff' },
  dots:           { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive:      { width: 20, backgroundColor: '#6C63FF' },
  footerNote:     { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 20 },
  footerLink:     { color: '#8B83FF', fontWeight: '600' },
});
