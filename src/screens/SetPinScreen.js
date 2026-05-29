/**
 * SetPinScreen.js
 * Shown after registration or when changing PIN.
 * Two-pass PIN entry: enter → confirm → save.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../utils/theme';

export default function SetPinScreen() {
  const { savePin, user, authError, setAuthError } = useAuth();

  const [phase,    setPhase]    = useState('enter');  // 'enter' | 'confirm'
  const [pin,      setPin]      = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [loading,  setLoading]  = useState(false);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => { setAuthError(''); }, []);

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
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,   duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key) => {
    if (key === 'del') { setPin(p => p.slice(0,-1)); setAuthError(''); return; }
    if (pin.length >= 4) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pin + key;
    setPin(next);
    popDot();
    if (next.length === 4) {
      if (phase === 'enter') {
        setTimeout(() => { setFirstPin(next); setPin(''); setPhase('confirm'); setAuthError(''); }, 250);
      } else {
        // Confirm phase
        if (next !== firstPin) {
          shake();
          setAuthError("PINs don't match — try again");
          setTimeout(() => { setPin(''); setPhase('enter'); setFirstPin(''); }, 700);
        } else {
          setLoading(true);
          await savePin(next);
          setLoading(false);
        }
      }
    }
  };

  const KEYPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','del']];
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <LinearGradient colors={['#0D0D1A','#151528','#1E1B4B']} style={s.bg}>
      <SafeAreaView style={s.safe}>
        {/* Logo */}
        <View style={s.logoRow}>
          <LinearGradient colors={['#6C63FF','#EC4899']} style={s.logoBox}>
            <Ionicons name="wallet-outline" size={22} color="#fff" />
          </LinearGradient>
          <Text style={s.logoText}>PocketWallet</Text>
        </View>

        {/* Header */}
        <View style={s.header}>
          <LinearGradient colors={['#6C63FF33','#EC489933']} style={s.iconRing}>
            <Ionicons name="keypad-outline" size={36} color="#fff" />
          </LinearGradient>
          <Text style={s.title}>
            {phase === 'enter' ? `Hi ${firstName}! 👋` : 'Confirm your PIN'}
          </Text>
          <Text style={s.sub}>
            {phase === 'enter'
              ? 'Choose a 4-digit PIN to protect your wallet'
              : 'Enter the same PIN to confirm'}
          </Text>
        </View>

        {/* Phase indicator */}
        <View style={s.phaseRow}>
          <View style={[s.phaseStep, s.phaseStepDone]}>
            <Ionicons name="checkmark" size={12} color="#fff" />
            <Text style={s.phaseStepTxt}>Account Created</Text>
          </View>
          <View style={s.phaseLine} />
          <View style={[s.phaseStep, phase === 'enter' && s.phaseStepActive, phase === 'confirm' && s.phaseStepDone]}>
            {phase === 'confirm' ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={s.phaseNum}>2</Text>}
            <Text style={s.phaseStepTxt}>{phase === 'enter' ? 'Set PIN' : 'PIN Set'}</Text>
          </View>
          <View style={s.phaseLine} />
          <View style={[s.phaseStep, phase === 'confirm' && s.phaseStepActive]}>
            <Text style={s.phaseNum}>3</Text>
            <Text style={s.phaseStepTxt}>Confirm PIN</Text>
          </View>
        </View>

        {/* PIN dots */}
        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          <Animated.View style={[s.dotsInner, { transform: [{ scale: scaleAnim }] }]}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[s.dot, pin.length > i && s.dotFilled]} />
            ))}
          </Animated.View>
        </Animated.View>

        {/* Error / hint */}
        <Text style={[s.hint, authError && s.hintErr]}>
          {authError || (phase === 'confirm' ? 'Re-enter to confirm' : 'Choose a memorable PIN')}
        </Text>

        {/* Keypad */}
        <View style={s.keypad}>
          {KEYPAD.map((row, ri) => (
            <View key={ri} style={s.keyRow}>
              {row.map((key, ki) => {
                if (!key) return <View key={ki} style={s.keyEmpty} />;
                if (key === 'del') return (
                  <TouchableOpacity key={key} style={s.keyBtn} onPress={() => handleKey('del')}>
                    <Ionicons name="backspace-outline" size={24} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                );
                return (
                  <TouchableOpacity key={key} style={s.keyBtn} onPress={() => handleKey(key)} disabled={loading}>
                    <Text style={s.keyTxt}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Security note */}
        <View style={s.secNote}>
          <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={s.secTxt}>Your PIN is stored locally and never transmitted</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg:              { flex: 1 },
  safe:            { flex: 1, alignItems: 'center', paddingHorizontal: 32, maxWidth: 480, alignSelf: 'center', width: '100%' },
  logoRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 24, alignSelf: 'flex-start' },
  logoBox:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText:        { fontSize: 17, fontWeight: '800', color: '#fff' },
  header:          { alignItems: 'center', marginBottom: 24, gap: 8 },
  iconRing:        { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title:           { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  sub:             { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
  // Phase indicator
  phaseRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  phaseStep:       { alignItems: 'center', gap: 4, minWidth: 70 },
  phaseStepActive: { },
  phaseStepDone:   { },
  phaseNum:        { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', textAlign: 'center', lineHeight: 22, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  phaseStepTxt:    { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  phaseLine:       { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 18 },
  // PIN dots
  dotsRow:         { marginBottom: 12 },
  dotsInner:       { flexDirection: 'row', gap: 20 },
  dot:             { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'transparent' },
  dotFilled:       { backgroundColor: '#6C63FF', borderColor: '#6C63FF', ...Platform.select({ ios: { shadowColor: '#6C63FF', shadowOpacity: 0.6, shadowRadius: 6, shadowOffset:{width:0,height:0} }, android:{ elevation: 4 } }) },
  hint:            { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 28, height: 20 },
  hintErr:         { color: '#FCA5A5' },
  // Keypad
  keypad:          { width: 280, gap: 14, alignSelf: 'center' },
  keyRow:          { flexDirection: 'row', justifyContent: 'space-between' },
  keyBtn:          { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  keyEmpty:        { width: 76, height: 76 },
  keyTxt:          { fontSize: 26, fontWeight: '400', color: '#fff' },
  // Security note
  secNote:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28 },
  secTxt:          { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
});
