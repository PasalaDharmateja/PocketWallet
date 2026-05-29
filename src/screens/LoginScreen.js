/**
 * LoginScreen.js
 * Shown when session has expired or user signs out.
 * Email + password → unlocks to PIN screen.
 * Also has "Forgot Password" placeholder.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { loginWithPassword, authError, setAuthError, user } = useAuth();

  const [email,    setEmail]    = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [passErr,  setPassErr]  = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    setAuthError('');
  }, []);

  const handleLogin = async () => {
    let valid = true;
    setEmailErr(''); setPassErr(''); setAuthError('');

    if (!email.trim())    { setEmailErr('Email is required');    valid = false; }
    if (!password.trim()) { setPassErr('Password is required');  valid = false; }
    if (!valid) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const ok = await loginWithPassword(email, password);
    setLoading(false);

    if (!ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <LinearGradient colors={['#0D0D1A','#151528','#1A1040']} style={s.bg}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Logo */}
            <View style={s.logoRow}>
              <LinearGradient colors={['#6C63FF','#EC4899']} style={s.logoBox}>
                <Ionicons name="wallet-outline" size={26} color="#fff" />
              </LinearGradient>
              <Text style={s.logoText}>PocketWallet</Text>
            </View>

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {/* Header */}
              <View style={s.header}>
                <View style={s.avatarWrap}>
                  {user?.name ? (
                    <LinearGradient colors={['#6C63FF','#EC4899']} style={s.avatar}>
                      <Text style={s.avatarTxt}>{user.name.charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.avatar}>
                      <Ionicons name="person-outline" size={28} color="rgba(255,255,255,0.5)" />
                    </View>
                  )}
                </View>
                <Text style={s.title}>
                  {user?.name ? `Welcome back,\n${user.name.split(' ')[0]}!` : 'Welcome back!'}
                </Text>
                <Text style={s.sub}>Sign in to access your wallet</Text>
              </View>

              {/* Email */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Email Address</Text>
                <View style={[s.fieldRow, emailErr && s.fieldRowErr]}>
                  <Ionicons name="mail-outline" size={18} color={emailErr ? '#FCA5A5' : 'rgba(255,255,255,0.35)'} />
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={t => { setEmail(t); setEmailErr(''); setAuthError(''); }}
                    placeholder="your@email.com"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    selectionColor="#6C63FF"
                  />
                </View>
                {emailErr ? <Text style={s.err}>{emailErr}</Text> : null}
              </View>

              {/* Password */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Password</Text>
                <View style={[s.fieldRow, passErr && s.fieldRowErr]}>
                  <Ionicons name="lock-closed-outline" size={18} color={passErr ? '#FCA5A5' : 'rgba(255,255,255,0.35)'} />
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={t => { setPassword(t); setPassErr(''); setAuthError(''); }}
                    placeholder="Your password"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    secureTextEntry={!showPass}
                    selectionColor="#6C63FF"
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                </View>
                {passErr ? <Text style={s.err}>{passErr}</Text> : null}
              </View>

              {/* Forgot password */}
              <TouchableOpacity style={s.forgotBtn} onPress={() => {}}>
                <Text style={s.forgotTxt}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Auth error */}
              {authError ? (
                <View style={s.errBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
                  <Text style={s.errBoxTxt}>{authError}</Text>
                </View>
              ) : null}

              {/* Sign In button */}
              <TouchableOpacity style={s.signInBtn} onPress={handleLogin} disabled={loading}>
                <LinearGradient colors={['#6C63FF','#EC4899']} style={s.signInGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                  {loading ? (
                    <Text style={s.signInTxt}>Signing in…</Text>
                  ) : (
                    <>
                      <Text style={s.signInTxt}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.divLine} />
                <Text style={s.divTxt}>secure login</Text>
                <View style={s.divLine} />
              </View>

              {/* Security badges */}
              <View style={s.badgeRow}>
                <View style={s.badge}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="rgba(108,99,255,0.7)" />
                  <Text style={s.badgeTxt}>256-bit Encrypted</Text>
                </View>
                <View style={s.badge}>
                  <Ionicons name="phone-portrait-outline" size={14} color="rgba(108,99,255,0.7)" />
                  <Text style={s.badgeTxt}>Local Storage</Text>
                </View>
                <View style={s.badge}>
                  <Ionicons name="finger-print" size={14} color="rgba(108,99,255,0.7)" />
                  <Text style={s.badgeTxt}>Biometric Ready</Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg:            { flex: 1 },
  scroll:        { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },
  logoRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 32 },
  logoBox:       { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  logoText:      { fontSize: 20, fontWeight: '800', color: '#fff' },
  header:        { alignItems: 'center', marginBottom: 32 },
  avatarWrap:    { marginBottom: 16 },
  avatar:        { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  avatarTxt:     { fontSize: 32, fontWeight: '800', color: '#fff' },
  title:         { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 32, marginBottom: 8 },
  sub:           { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  fieldWrap:     { marginBottom: 14 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 },
  fieldRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  fieldRowErr:   { borderColor: '#EF444460', backgroundColor: 'rgba(239,68,68,0.06)' },
  input:         { flex: 1, fontSize: 15, color: '#fff', fontFamily: Platform.select({ ios: 'System', android: 'Roboto', web: 'inherit' }) },
  err:           { fontSize: 11, color: '#FCA5A5', marginTop: 5, marginLeft: 4 },
  forgotBtn:     { alignSelf: 'flex-end', marginBottom: 16, marginTop: 4 },
  forgotTxt:     { fontSize: 13, color: '#8B83FF', fontWeight: '600' },
  errBox:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errBoxTxt:     { flex: 1, fontSize: 13, color: '#FCA5A5' },
  signInBtn:     { borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  signInGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  signInTxt:     { fontSize: 17, fontWeight: '800', color: '#fff' },
  divider:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  divLine:       { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  divTxt:        { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(108,99,255,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)' },
  badgeTxt:      { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
});
