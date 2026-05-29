/**
 * LockScreen.js
 * Shown when the user has an account + valid session but needs
 * PIN or biometric confirmation before entering the app.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';

export default function LockScreen() {
  const { unlockWithPin, unlockWithBiometric, forgotPin, user, authError, setAuthError } = useAuth();

  const [pin, setPin]     = React.useState('');
  const [mode, setMode]   = React.useState('biometric');
  const shakeAnim         = useRef(new Animated.Value(0)).current;
  const dotScale          = useRef(new Animated.Value(1)).current;

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:-12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const popDot = () => {
    Animated.sequence([
      Animated.timing(dotScale, { toValue: 1.15, duration: 70, useNativeDriver: true }),
      Animated.timing(dotScale, { toValue: 1,    duration: 70, useNativeDriver: true }),
    ]).start();
  };

  const attemptBiometric = async () => {
    try {
      if (Platform.OS === 'web') { setMode('pin'); return; }
      // Lazy-load so the native module is never required on web
      const LA = require('expo-local-authentication');
      const hasHW      = await LA.hasHardwareAsync();
      const isEnrolled = await LA.isEnrolledAsync();
      if (hasHW && isEnrolled) {
        const result = await LA.authenticateAsync({
          promptMessage: 'Authenticate to open PocketWallet',
          fallbackLabel: 'Use PIN',
          cancelLabel:   'Cancel',
        });
        if (result.success) { unlockWithBiometric(); return; }
      }
    } catch (_) {}
    setMode('pin');
  };

  useEffect(() => {
    setAuthError('');
    attemptBiometric();
  }, []);

  const handleKey = async (key) => {
    if (key === 'del') { setPin(p => p.slice(0,-1)); setAuthError(''); return; }
    if (pin.length >= 4) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pin + key;
    setPin(next);
    popDot();
    if (next.length === 4) {
      const ok = await unlockWithPin(next);
      if (!ok) {
        shake();
        setTimeout(() => { setPin(''); setAuthError(''); }, 600);
      }
    }
  };

  const KEYPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['bio','0','del']];
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    : '?';

  return (
    <LinearGradient colors={['#0D0D1A','#151528','#1E1B4B']} style={s.bg}>
      <SafeAreaView style={s.safe}>

        {/* Logo row */}
        <View style={s.logoRow}>
          <LinearGradient colors={['#6C63FF','#EC4899']} style={s.logoBox}>
            <Ionicons name="wallet-outline" size={22} color="#fff" />
          </LinearGradient>
          <Text style={s.logoText}>PocketWallet</Text>
        </View>

        {/* User avatar + greeting */}
        <View style={s.userBlock}>
          <LinearGradient colors={['#6C63FF','#EC4899']} style={s.avatar}>
            <Text style={s.avatarTxt}>{initials}</Text>
          </LinearGradient>
          <Text style={s.greeting}>
            {user?.name ? `Welcome back,\n${user.name.split(' ')[0]}!` : 'Welcome back!'}
          </Text>
          <Text style={s.sub}>
            {mode === 'biometric' ? 'Authenticating with biometrics…' : 'Enter your PIN to continue'}
          </Text>
        </View>

        {/* PIN dots */}
        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          <Animated.View style={[s.dotsInner, { transform: [{ scale: dotScale }] }]}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[s.dot, pin.length > i && s.dotFilled]} />
            ))}
          </Animated.View>
        </Animated.View>

        {/* Error / hint */}
        <Text style={[s.hint, authError && s.hintErr]}>
          {authError || 'Enter your 4-digit PIN'}
        </Text>

        {/* Keypad */}
        <View style={s.keypad}>
          {KEYPAD.map((row, ri) => (
            <View key={ri} style={s.keyRow}>
              {row.map(key => {
                if (key === 'bio') return (
                  <TouchableOpacity key={key} style={s.keyBtn} onPress={attemptBiometric}>
                    <Ionicons
                      name={Platform.OS === 'ios' ? 'finger-print' : 'finger-print'}
                      size={26} color="rgba(255,255,255,0.7)"
                    />
                  </TouchableOpacity>
                );
                if (key === 'del') return (
                  <TouchableOpacity key={key} style={s.keyBtn} onPress={() => handleKey('del')}>
                    <Ionicons name="backspace-outline" size={24} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                );
                return (
                  <TouchableOpacity key={key} style={s.keyBtn} onPress={() => handleKey(key)}>
                    <Text style={s.keyTxt}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Forgot PIN */}
        <TouchableOpacity style={s.forgotBtn} onPress={forgotPin}>
          <Ionicons name="help-circle-outline" size={14} color="rgba(108,99,255,0.7)" />
          <Text style={s.forgotTxt}>Forgot PIN? Sign in with password</Text>
        </TouchableOpacity>

        <Text style={s.secNote}>
          <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.2)" />
          {' '}Bank-level 256-bit encryption
        </Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg:        { flex: 1 },
  safe:      { flex: 1, alignItems: 'center', paddingHorizontal: 32, maxWidth: 480, alignSelf: 'center', width: '100%' },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, alignSelf: 'flex-start', marginBottom: 8 },
  logoBox:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  userBlock: { alignItems: 'center', marginTop: 16, marginBottom: 28, gap: 10 },
  avatar:    { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 26, fontWeight: '800', color: '#fff' },
  greeting:  { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 28 },
  sub:       { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  dotsRow:   { marginBottom: 10 },
  dotsInner: { flexDirection: 'row', gap: 20 },
  dot:       { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  hint:      { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 28, height: 20 },
  hintErr:   { color: '#FCA5A5' },
  keypad:    { width: 280, gap: 14, alignSelf: 'center' },
  keyRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  keyBtn:    { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  keyTxt:    { fontSize: 26, fontWeight: '400', color: '#fff' },
  forgotBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 24 },
  forgotTxt: { fontSize: 12, color: 'rgba(108,99,255,0.8)', fontWeight: '600' },
  secNote:   { position: 'absolute', bottom: 32, fontSize: 11, color: 'rgba(255,255,255,0.2)' },
});
