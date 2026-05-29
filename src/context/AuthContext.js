/**
 * AuthContext.js
 * Manages the full auth lifecycle:
 *   - First install: no account → Register → Set PIN → Home
 *   - Return visit (session alive): PIN/Biometric → Home
 *   - Return visit (session expired): Login → PIN → Home
 *   - Forgot PIN: re-login with email+password → reset PIN
 *
 * Supabase integration:
 *   - register()          → creates row in users table
 *   - savePin()           → updates pin_hash in users table
 *   - loginWithPassword() → fetches user from Supabase, falls back to AsyncStorage
 *   - deleteAccount()     → deletes user row (cascades to all related data)
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUser        as dbCreateUser,
  getUserByEmail    as dbGetUserByEmail,
  savePinHash       as dbSavePinHash,
  supabase,
} from '../services/supabaseClient';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const AUTH_KEY    = '@pocketwallet_auth_v1';
const SESSION_KEY = '@pocketwallet_session_v1';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ── Auth screen states ─────────────────────────────────────────────────────────
export const AUTH_STATE = {
  LOADING:  'loading',   // checking storage
  REGISTER: 'register',  // first install — no account yet
  VERIFY:   'verify',    // email OTP / phone verification
  SET_PIN:  'set_pin',   // post-register: choose PIN
  LOGIN:    'login',     // has account, session expired
  LOCK:     'lock',      // has account + session, needs PIN/bio
  APP:      'app',       // fully authenticated, show main app
};

// ── Validators ─────────────────────────────────────────────────────────────────
export const validatePassword = (p) => {
  const errors = [];
  if (p.length < 8)     errors.push('At least 8 characters');
  if (!/[A-Z]/.test(p)) errors.push('One uppercase letter');
  if (!/[0-9]/.test(p)) errors.push('One number');
  return errors;
};
export const validatePhone = (p) => /^[6-9]\d{9}$/.test(p.replace(/\s/g, ''));
export const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

// ── Simple password hash (local — not cryptographic) ──────────────────────────
const hashPin   = (p) => btoa(p + ':pw_salt_v1');
const checkPin  = (input, stored) => hashPin(input) === stored;
const hashPass  = (p) => btoa(p + ':pw_pass_salt_v1');
const checkPass = (input, stored) => hashPass(input) === stored;

// ── Map Supabase user row (snake_case) → app user object (camelCase) ──────────
const mapDbUser = (row) => ({
  id:        row.id,
  name:      row.name,
  email:     row.email,
  phone:     row.phone,
  passHash:  row.pass_hash,
  pinHash:   row.pin_hash,
  avatar:    row.avatar,
  createdAt: row.created_at,
});

// ═════════════════════════════════════════════════════════════════════════════
export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(AUTH_STATE.LOADING);
  const [user,      setUser]      = useState(null);
  const [authError, setAuthError] = useState('');

  // ── Boot: determine initial screen ────────────────────────────────────────
  useEffect(() => {
    const boot = async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (!raw) { setAuthState(AUTH_STATE.REGISTER); return; }

        const stored = JSON.parse(raw);

        // No PIN yet → still in setup
        if (!stored.pinHash) {
          setUser(stored);
          setAuthState(AUTH_STATE.SET_PIN);
          return;
        }

        // Has account — check session freshness
        const sessRaw = await AsyncStorage.getItem(SESSION_KEY);
        if (sessRaw) {
          const sess = JSON.parse(sessRaw);
          if (Date.now() - sess.ts < SESSION_TTL) {
            setUser(stored);
            setAuthState(AUTH_STATE.LOCK);
            return;
          }
        }
        // Session expired — full login required
        setUser(stored);
        setAuthState(AUTH_STATE.LOGIN);
      } catch (_) {
        setAuthState(AUTH_STATE.REGISTER);
      }
    };
    boot();
  }, []);

  // ── Register ───────────────────────────────────────────────────────────────
  const register = useCallback(async ({ name, email, phone, password }) => {
    setAuthError('');
    if (!name.trim())           { setAuthError('Full name is required.');        return false; }
    if (!validateEmail(email))  { setAuthError('Enter a valid email address.');  return false; }
    if (!validatePhone(phone))  { setAuthError('Enter a valid 10-digit mobile.'); return false; }
    const pwErrors = validatePassword(password);
    if (pwErrors.length)        { setAuthError(pwErrors[0]);                     return false; }

    const passHash = hashPass(password);
    const avatar   = name.trim().charAt(0).toUpperCase();

    // ── Save to Supabase ────────────────────────────────────────────────────
    let dbId = null;
    try {
      const row = await dbCreateUser({
        name:     name.trim(),
        email:    email.trim().toLowerCase(),
        phone:    phone.replace(/\s/g, ''),
        passHash,
        avatar,
      });
      dbId = row.id;
    } catch (e) {
      console.warn('Supabase register failed, continuing offline:', e.message);
    }

    const userData = {
      id:        dbId,   // Supabase UUID (null if offline)
      name:      name.trim(),
      email:     email.trim().toLowerCase(),
      phone:     phone.replace(/\s/g, ''),
      passHash,
      pinHash:   null,
      avatar,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    setUser(userData);
    setAuthState(AUTH_STATE.SET_PIN);
    return true;
  }, []);

  // ── Set / Reset PIN ────────────────────────────────────────────────────────
  const savePin = useCallback(async (pin) => {
    setAuthError('');
    if (!/^\d{4}$/.test(pin)) { setAuthError('PIN must be exactly 4 digits.'); return false; }

    const raw     = await AsyncStorage.getItem(AUTH_KEY);
    const stored  = raw ? JSON.parse(raw) : {};
    const pinHash = hashPin(pin);
    const updated = { ...stored, pinHash };

    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    setUser(updated);

    // ── Sync PIN hash to Supabase ───────────────────────────────────────────
    if (stored.id) {
      try { await dbSavePinHash(stored.id, pinHash); }
      catch (e) { console.warn('Supabase savePinHash failed:', e.message); }
    }

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }));
    setAuthState(AUTH_STATE.APP);
    return true;
  }, []);

  // ── Login with email + password ────────────────────────────────────────────
  const loginWithPassword = useCallback(async (email, password) => {
    setAuthError('');

    // ── Try Supabase first ──────────────────────────────────────────────────
    try {
      const dbUser = await dbGetUserByEmail(email);
      if (dbUser) {
        if (!checkPass(password, dbUser.pass_hash)) {
          setAuthError('Incorrect password.');
          return false;
        }
        const userData = mapDbUser(dbUser);
        await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
        setUser(userData);
        setAuthState(AUTH_STATE.LOCK);
        return true;
      }
    } catch (e) {
      console.warn('Supabase login failed, trying local:', e.message);
    }

    // ── Fallback: AsyncStorage (offline) ───────────────────────────────────
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) { setAuthError('No account found. Please register.'); return false; }

    const stored = JSON.parse(raw);
    if (stored.email !== email.trim().toLowerCase()) {
      setAuthError('Email not found.');
      return false;
    }
    if (!checkPass(password, stored.passHash)) {
      setAuthError('Incorrect password.');
      return false;
    }
    setUser(stored);
    setAuthState(AUTH_STATE.LOCK);
    return true;
  }, []);

  // ── Unlock with PIN ────────────────────────────────────────────────────────
  const unlockWithPin = useCallback(async (pin) => {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw);
    if (!checkPin(pin, stored.pinHash)) return false;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }));
    setAuthState(AUTH_STATE.APP);
    return true;
  }, []);

  // ── Biometric success — skip PIN ──────────────────────────────────────────
  const unlockWithBiometric = useCallback(async () => {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }));
    setAuthState(AUTH_STATE.APP);
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setAuthState(AUTH_STATE.LOGIN);
  }, []);

  // ── Delete account (nuclear) ───────────────────────────────────────────────
  const deleteAccount = useCallback(async () => {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.id) {
        // Delete from Supabase — cascades to pockets, transactions, schedules, notifications
        try {
          await supabase.from('users').delete().eq('id', stored.id);
        } catch (e) {
          console.warn('Supabase deleteAccount failed:', e.message);
        }
      }
    }
    await AsyncStorage.multiRemove([AUTH_KEY, SESSION_KEY, '@pocketwallet_data_v2']);
    setUser(null);
    setAuthState(AUTH_STATE.REGISTER);
  }, []);

  // ── Change PIN ─────────────────────────────────────────────────────────────
  const changePin = useCallback(async (currentPin, newPin) => {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) return { ok: false, error: 'No account found.' };
    const stored = JSON.parse(raw);
    if (!checkPin(currentPin, stored.pinHash)) return { ok: false, error: 'Current PIN is incorrect.' };
    if (!/^\d{4}$/.test(newPin)) return { ok: false, error: 'New PIN must be 4 digits.' };
    const pinHash = hashPin(newPin);
    const updated = { ...stored, pinHash };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    setUser(updated);
    if (stored.id) {
      try { await dbSavePinHash(stored.id, pinHash); }
      catch (e) { console.warn('Supabase changePin failed:', e.message); }
    }
    return { ok: true };
  }, []);

  // ── Reset PIN (navigate to login) ─────────────────────────────────────────
  const forgotPin = useCallback(async () => {
    setAuthState(AUTH_STATE.LOGIN);
  }, []);

  return (
    <AuthContext.Provider value={{
      authState, user, authError, setAuthError,
      register, savePin, loginWithPassword,
      unlockWithPin, unlockWithBiometric,
      signOut, deleteAccount, changePin, forgotPin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
