/**
 * WalletContext.js
 *
 * Local state + Supabase cloud sync.
 *
 * Strategy:
 *   • On mount (userId available): load from Supabase, fall back to AsyncStorage.
 *   • Every mutation: update local state immediately (snappy UI), then fire-and-
 *     forget Supabase sync in the background.
 *   • AsyncStorage still used as an offline/session cache.
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  supabase,
  updateWalletBalance       as dbUpdateWalletBalance,
  getPockets                as dbGetPockets,
  createPocket              as dbCreatePocket,
  updatePocket              as dbUpdatePocket,
  deletePocket              as dbDeletePocket,
  getAllTransactions         as dbGetAllTransactions,
  addTransaction            as dbAddTransaction,
  getScheduledPayments      as dbGetScheduledPayments,
  createScheduledPayment    as dbCreateScheduledPayment,
  updateScheduledPayment    as dbUpdateScheduledPayment,
  getNotifications          as dbGetNotifications,
  addNotification           as dbAddNotification,
  markAllNotificationsRead  as dbMarkAllNotificationsRead,
  deleteNotification        as dbDeleteNotification,
  clearAllNotifications     as dbClearAllNotifications,
} from '../services/supabaseClient';

const WalletContext = createContext();
export const useWallet = () => useContext(WalletContext);

const STORAGE_KEY = '@pocketwallet_data_v2';

// ── Constants ─────────────────────────────────────────────────────────────────
export const RECURRENCE = {
  once:      { label: 'One-time',  icon: 'calendar-outline',        days: null },
  daily:     { label: 'Daily',     icon: 'today-outline',            days: 1    },
  weekly:    { label: 'Weekly',    icon: 'calendar-number-outline',  days: 7    },
  biweekly:  { label: 'Bi-weekly', icon: 'calendar-number-outline',  days: 14   },
  monthly:   { label: 'Monthly',   icon: 'calendar-outline',         days: 30   },
  quarterly: { label: 'Quarterly', icon: 'calendar-outline',         days: 90   },
};

export const SCHED_STATUS = {
  upcoming:   'upcoming',
  processing: 'processing',
  completed:  'completed',
  failed:     'failed',
  paused:     'paused',
  cancelled:  'cancelled',
};

export const PAY_METHOD = {
  'upi-id':    { label: 'UPI ID',        icon: 'at-circle-outline'   },
  'upi-phone': { label: 'UPI Phone',     icon: 'call-outline'        },
  'upi-qr':    { label: 'UPI QR',        icon: 'qr-code-outline'     },
  'bank':      { label: 'Bank Transfer', icon: 'business-outline'    },
  'pocket':    { label: 'To Pocket',     icon: 'layers-outline'      },
  'wallet':    { label: 'Add to Wallet', icon: 'wallet-outline'      },
};

export const POCKET_COLORS = [
  '#10B981','#3B82F6','#8B5CF6','#EC4899',
  '#F59E0B','#06B6D4','#EF4444','#84CC16',
];

export const PRIORITY_CONFIG = {
  high:   { label: 'High',   stars: '⭐⭐⭐', bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', order: 3 },
  medium: { label: 'Medium', stars: '⭐⭐',   bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', order: 2 },
  low:    { label: 'Low',    stars: '⭐',     bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A', order: 1 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

const advanceDate = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const isOverdue = (sched) => {
  if (sched.status !== 'upcoming') return false;
  const due = new Date(`${sched.nextRunDate}T${sched.scheduledTime || '00:00'}:00`);
  return due <= new Date();
};

const formatRelativeDate = (dateStr) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0 && diff < 7) return `In ${diff} days`;
  if (diff < 0)   return `${Math.abs(diff)} days ago`;
  return dateStr;
};

export { formatRelativeDate };

// ── Map Supabase rows to local camelCase objects ───────────────────────────────
const mapDbPockets = (dbPockets, dbTxns) =>
  (dbPockets || []).map(p => ({
    id:       p.id,
    name:     p.name,
    balance:  parseFloat(p.balance) || 0,
    priority: p.priority,
    color:    p.color,
    transactions: (dbTxns || [])
      .filter(t => t.pocket_id === p.id)
      .map(t => ({
        id:          t.id,
        type:        t.type,
        amount:      parseFloat(t.amount) || 0,
        date:        t.date,
        description: t.description,
        status:      t.status,
      })),
  }));

const mapDbSchedules = (rows) =>
  (rows || []).map(s => ({
    id:            s.id,
    label:         s.label,
    paymentType:   s.payment_type,
    recipient:     s.recipient,
    ifsc:          s.ifsc,
    toPocketId:    s.to_pocket_id,
    toPocketName:  s.to_pocket_name,
    amount:        parseFloat(s.amount) || 0,
    pocketId:      s.pocket_id,
    pocketName:    s.pocket_name,
    recurrence:    s.recurrence,
    scheduledDate: s.scheduled_date,
    scheduledTime: (s.scheduled_time || '09:00:00').slice(0, 5),
    status:        s.status,
    note:          s.note || '',
    createdAt:     (s.created_at || '').split('T')[0],
    execCount:     s.exec_count || 0,
    nextRunDate:   s.next_run_date,
    endDate:       s.end_date || null,
  }));

const mapDbNotifs = (rows) =>
  (rows || []).map(n => ({
    id:      n.id,
    type:    n.type,
    title:   n.title,
    message: n.message,
    time:    'Recently',
    read:    n.read,
  }));

// ── Fire-and-forget DB sync helper ────────────────────────────────────────────
const sync = (promise) => {
  promise.catch(e => console.warn('[Supabase sync]', e?.message ?? e));
};

// ═════════════════════════════════════════════════════════════════════════════
export const WalletProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [walletBalance,     setWalletBalance]     = useState(0);
  const [pockets,           setPockets]           = useState([]);
  const [notifications,     setNotifications]     = useState([]);
  const [scheduledPayments, setScheduledPayments] = useState([]);
  const [isLoading,         setIsLoading]         = useState(true);

  const dueDateCheckRef = useRef(null);

  // ── Load from Supabase when userId becomes available ─────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        if (userId) {
          // Fetch all data in parallel
          const [pocketsData, txnsData, schedulesData, notifsData, userRow] =
            await Promise.all([
              dbGetPockets(userId),
              dbGetAllTransactions(userId),
              dbGetScheduledPayments(userId),
              dbGetNotifications(userId),
              supabase.from('users').select('wallet_balance').eq('id', userId).single(),
            ]);

          if (cancelled) return;

          setPockets(mapDbPockets(pocketsData, txnsData));
          setScheduledPayments(mapDbSchedules(schedulesData));
          setNotifications(mapDbNotifs(notifsData));
          if (userRow.data?.wallet_balance != null) {
            setWalletBalance(parseFloat(userRow.data.wallet_balance) || 0);
          }
        } else {
          // Not logged in — try AsyncStorage cache
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw && !cancelled) {
            const saved = JSON.parse(raw);
            if (saved.walletBalance  != null) setWalletBalance(saved.walletBalance);
            if (saved.pockets)                setPockets(saved.pockets);
            if (saved.notifications)          setNotifications(saved.notifications);
            if (saved.scheduledPayments)      setScheduledPayments(saved.scheduledPayments);
          }
        }
      } catch (e) {
        console.warn('Failed to load from Supabase, trying AsyncStorage:', e.message);
        if (!cancelled) {
          const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved.walletBalance  != null) setWalletBalance(saved.walletBalance);
            if (saved.pockets)                setPockets(saved.pockets);
            if (saved.notifications)          setNotifications(saved.notifications);
            if (saved.scheduledPayments)      setScheduledPayments(saved.scheduledPayments);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── AsyncStorage backup (offline cache) ──────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      walletBalance, pockets, notifications, scheduledPayments,
    })).catch(() => {});
  }, [walletBalance, pockets, notifications, scheduledPayments, isLoading]);

  // ── Due-date checker (runs every 60 s) ────────────────────────────────────
  useEffect(() => {
    const check = () => {
      setScheduledPayments(prev => {
        let changed = false;
        const updated = prev.map(s => {
          if (!isOverdue(s)) return s;
          changed = true;
          return executeScheduleInternal(s, true);
        });
        return changed ? updated : prev;
      });
    };
    check();
    dueDateCheckRef.current = setInterval(check, 60_000);
    return () => clearInterval(dueDateCheckRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Low-balance alert: fires for current-month scheduled payments only ───────
  const lowBalAlertedRef = useRef(new Set());
  useEffect(() => {
    if (isLoading) return;
    const curMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    scheduledPayments.forEach(s => {
      if (s.status !== 'upcoming' && s.status !== 'paused') return;
      if (!s.pocketId || !s.amount) return;
      const dateStr = s.nextRunDate || s.scheduledDate || '';
      if (dateStr.slice(0, 7) !== curMonth) return;
      const pocket = pockets.find(p => p.id === s.pocketId);
      if (!pocket) return;
      if (pocket.balance >= s.amount) {
        // Balance recovered — allow re-alert next time it dips
        lowBalAlertedRef.current.delete(s.id);
        return;
      }
      // Already alerted for this schedule in this session
      if (lowBalAlertedRef.current.has(s.id)) return;
      lowBalAlertedRef.current.add(s.id);
      addNotification(
        'warning',
        'Low Pocket Balance',
        `"${pocket.name}" has ₹${pocket.balance.toLocaleString('en-IN')} but "${s.label || 'a scheduled payment'}" needs ₹${s.amount.toLocaleString('en-IN')}.`,
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pockets, scheduledPayments, isLoading]);

  // ── Notification helpers ───────────────────────────────────────────────────
  const addNotification = useCallback((type, title, message) => {
    const n = { id: `n${Date.now()}`, type, title, message, time: 'Just now', read: false };
    setNotifications(prev => [n, ...prev]);
    if (userId) sync(dbAddNotification(userId, { type, title, message }));
  }, [userId]);

  const markAllRead = useCallback(() => {
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    if (userId) sync(dbMarkAllNotificationsRead(userId));
  }, [userId]);

  const dismissNotif = useCallback((id) => {
    setNotifications(p => p.filter(n => n.id !== id));
    if (userId) sync(dbDeleteNotification(id));
  }, [userId]);

  const clearAllNotifs = useCallback(() => {
    setNotifications([]);
    if (userId) sync(dbClearAllNotifications(userId));
  }, [userId]);

  // ── Wallet actions ─────────────────────────────────────────────────────────
  const addMoneyToWallet = useCallback((amount, method) => {
    const newBal = walletBalance + amount;
    setWalletBalance(newBal);
    addNotification('success', 'Wallet Topped Up', `₹${amount.toLocaleString('en-IN')} added via ${method}.`);
    if (userId) sync(dbUpdateWalletBalance(userId, newBal));
  }, [walletBalance, addNotification, userId]);

  const allocateToPocket = useCallback((pocketId, amount) => {
    const pocket = pockets.find(p => p.id === pocketId);
    if (!pocket || amount > walletBalance || amount <= 0) return false;

    const today           = todayStr();
    const newWalletBal    = walletBalance - amount;
    const newPocketBal    = pocket.balance + amount;
    const tx = { id: `t${Date.now()}`, type: 'credit', amount, date: today, description: 'Added from wallet', status: 'completed' };

    setWalletBalance(newWalletBal);
    if (newWalletBal < 500) addNotification('warning', 'Low Wallet Balance', `Wallet is now ₹${newWalletBal.toLocaleString('en-IN')}.`);
    setPockets(prev => prev.map(p => p.id !== pocketId ? p : { ...p, balance: newPocketBal, transactions: [tx, ...p.transactions] }));
    addNotification('success', 'Funds Allocated', `₹${amount.toLocaleString('en-IN')} → "${pocket.name}".`);

    if (userId) {
      sync(dbUpdateWalletBalance(userId, newWalletBal));
      sync(dbUpdatePocket(pocketId, { balance: newPocketBal }));
      sync(dbAddTransaction(userId, pocketId, tx));
    }
    return true;
  }, [pockets, walletBalance, addNotification, userId]);

  const withdrawFromPocket = useCallback((pocketId, amount) => {
    const pocket = pockets.find(p => p.id === pocketId);
    if (!pocket || amount > pocket.balance || amount <= 0) return false;

    const today        = todayStr();
    const newPocketBal = Math.max(0, pocket.balance - amount);   // clamp: never negative
    const newWalletBal = walletBalance + amount;
    const tx = { id: `t${Date.now()}`, type: 'debit', amount, date: today, description: 'Moved to wallet', status: 'completed' };

    setWalletBalance(newWalletBal);
    setPockets(prev => prev.map(p => {
      if (p.id !== pocketId) return p;
      if (newPocketBal < 200) addNotification('warning', 'Low Pocket Balance', `"${p.name}" is now ₹${newPocketBal.toLocaleString('en-IN')}.`);
      return { ...p, balance: newPocketBal, transactions: [tx, ...p.transactions] };
    }));
    addNotification('info', 'Funds Returned', `₹${amount.toLocaleString('en-IN')} from "${pocket.name}" → wallet.`);

    if (userId) {
      sync(dbUpdateWalletBalance(userId, newWalletBal));
      sync(dbUpdatePocket(pocketId, { balance: newPocketBal }));
      sync(dbAddTransaction(userId, pocketId, tx));
    }
    return true;
  }, [pockets, walletBalance, addNotification, userId]);

  const sendUpiPayment = useCallback((pocketId, amount, recipient, note, method) => {
    const pocket = pockets.find(p => p.id === pocketId);
    if (!pocket || amount > pocket.balance || amount <= 0) return false;

    const today        = todayStr();
    const newPocketBal = Math.max(0, pocket.balance - amount);   // clamp: never negative
    const tx = {
      id: `t${Date.now()}`, type: 'debit', amount, date: today,
      description: `UPI to ${recipient}${note ? ` - ${note}` : ''}`, status: 'completed',
    };

    setPockets(prev => prev.map(p => {
      if (p.id !== pocketId) return p;
      if (newPocketBal < 200) addNotification('warning', 'Low Pocket Balance', `"${p.name}" is now ₹${newPocketBal.toLocaleString('en-IN')}.`);
      return { ...p, balance: newPocketBal, transactions: [tx, ...p.transactions] };
    }));
    addNotification('success', 'UPI Payment Sent', `₹${amount.toLocaleString('en-IN')} → ${recipient} from "${pocket.name}".`);

    if (userId) {
      sync(dbUpdatePocket(pocketId, { balance: newPocketBal }));
      sync(dbAddTransaction(userId, pocketId, tx));
    }
    return true;
  }, [pockets, addNotification, userId]);

  const sendBankTransfer = useCallback((pocketId, amount, accountNo, ifsc, note) => {
    const pocket = pockets.find(p => p.id === pocketId);
    if (!pocket || amount > pocket.balance || amount <= 0) return false;

    const today        = todayStr();
    const newPocketBal = Math.max(0, pocket.balance - amount);   // clamp: never negative
    const tx = {
      id: `t${Date.now()}`, type: 'debit', amount, date: today,
      description: `Bank Transfer to ****${accountNo.slice(-4)}${note ? ` - ${note}` : ''}`,
      status: 'completed',
    };

    setPockets(prev => prev.map(p => {
      if (p.id !== pocketId) return p;
      if (newPocketBal < 200) addNotification('warning', 'Low Pocket Balance', `"${p.name}" is now ₹${newPocketBal.toLocaleString('en-IN')}.`);
      return { ...p, balance: newPocketBal, transactions: [tx, ...p.transactions] };
    }));
    addNotification('info', 'Bank Transfer Initiated', `₹${amount.toLocaleString('en-IN')} → ****${accountNo.slice(-4)} from "${pocket.name}".`);

    if (userId) {
      sync(dbUpdatePocket(pocketId, { balance: newPocketBal }));
      sync(dbAddTransaction(userId, pocketId, tx));
    }
    return true;
  }, [pockets, addNotification, userId]);

  // ── Pocket CRUD ────────────────────────────────────────────────────────────
  const createPocket = useCallback(async (name, priority) => {
    if (pockets.length >= 100) return false;
    const color = POCKET_COLORS[pockets.length % POCKET_COLORS.length];

    let pocketId = `p${Date.now()}`;
    if (userId) {
      try {
        const row = await dbCreatePocket(userId, { name, balance: 0, priority, color });
        pocketId  = row.id; // use Supabase UUID
      } catch (e) {
        console.warn('Supabase createPocket failed:', e.message);
      }
    }

    setPockets(prev => [...prev, { id: pocketId, name, balance: 0, priority, color, transactions: [] }]);
    addNotification('info', 'Pocket Created', `"${name}" (${priority} priority) ready.`);
    return true;
  }, [pockets, addNotification, userId]);

  const renamePocket = useCallback((id, name) => {
    setPockets(p => p.map(x => x.id === id ? { ...x, name } : x));
    if (userId) sync(dbUpdatePocket(id, { name }));
  }, [userId]);

  const updatePocketPriority = useCallback((id, priority) => {
    setPockets(p => p.map(x => x.id === id ? { ...x, priority } : x));
    if (userId) sync(dbUpdatePocket(id, { priority }));
  }, [userId]);

  const deletePocket = useCallback((pocketId) => {
    const pocket = pockets.find(p => p.id === pocketId);
    if (!pocket) return;

    const refund = pocket.balance > 0 ? pocket.balance : 0;
    if (refund > 0) {
      const newWalletBal = walletBalance + refund;
      setWalletBalance(newWalletBal);
      if (userId) sync(dbUpdateWalletBalance(userId, newWalletBal));
    }

    setPockets(prev => prev.filter(p => p.id !== pocketId));

    // Cancel related schedules locally + in DB
    setScheduledPayments(prev => prev.map(s => {
      if (s.pocketId !== pocketId) return s;
      if (userId) sync(dbUpdateScheduledPayment(s.id, { status: 'cancelled' }));
      return { ...s, status: 'cancelled' };
    }));

    addNotification(
      'info', 'Pocket Deleted',
      `"${pocket.name}" deleted.${refund > 0 ? ` ₹${refund.toLocaleString('en-IN')} returned.` : ''}`,
    );
    if (userId) sync(dbDeletePocket(pocketId));
  }, [pockets, walletBalance, addNotification, userId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULED PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const createSchedule = useCallback(async (data) => {
    const schedule = {
      id:            `sch${Date.now()}`,
      label:         data.label        || `${data.paymentType} payment`,
      paymentType:   data.paymentType,
      recipient:     data.recipient    || null,
      ifsc:          data.ifsc         || null,
      toPocketId:    data.toPocketId   || null,
      toPocketName:  data.toPocketName || null,
      amount:        parseFloat(data.amount),
      pocketId:      data.pocketId     || null,
      pocketName:    data.pocketName   || 'Wallet',
      recurrence:    data.recurrence   || 'once',
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime || '09:00',
      status:        'upcoming',
      note:          data.note         || '',
      createdAt:     todayStr(),
      execCount:     0,
      nextRunDate:   data.scheduledDate,
      endDate:       data.endDate      || null,
    };

    if (userId) {
      try {
        const row  = await dbCreateScheduledPayment(userId, schedule);
        schedule.id = row.id; // use Supabase UUID
      } catch (e) {
        console.warn('Supabase createSchedule failed:', e.message);
      }
    }

    setScheduledPayments(prev => [schedule, ...prev]);
    addNotification('info', 'Payment Scheduled',
      `₹${schedule.amount.toLocaleString('en-IN')} · ${schedule.label} on ${formatRelativeDate(schedule.scheduledDate)}.`);
    return schedule;
  }, [addNotification, userId]);

  const editSchedule = useCallback((id, updates) => {
    setScheduledPayments(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...s, ...updates };
      if (updates.scheduledDate) next.nextRunDate = updates.scheduledDate;
      return next;
    }));
    if (userId) sync(dbUpdateScheduledPayment(id, updates));
    addNotification('info', 'Schedule Updated', 'Payment schedule has been updated.');
  }, [addNotification, userId]);

  const pauseSchedule = useCallback((id) => {
    setScheduledPayments(prev => prev.map(s =>
      s.id === id && s.status === 'upcoming' ? { ...s, status: 'paused' } : s,
    ));
    if (userId) sync(dbUpdateScheduledPayment(id, { status: 'paused' }));
    addNotification('warning', 'Schedule Paused', 'Scheduled payment has been paused.');
  }, [addNotification, userId]);

  const resumeSchedule = useCallback((id) => {
    setScheduledPayments(prev => prev.map(s =>
      s.id === id && s.status === 'paused' ? { ...s, status: 'upcoming' } : s,
    ));
    if (userId) sync(dbUpdateScheduledPayment(id, { status: 'upcoming' }));
    addNotification('success', 'Schedule Resumed', 'Scheduled payment is active again.');
  }, [addNotification, userId]);

  const cancelSchedule = useCallback((id) => {
    const s = scheduledPayments.find(x => x.id === id);
    setScheduledPayments(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled' } : x));
    if (userId) sync(dbUpdateScheduledPayment(id, { status: 'cancelled' }));
    if (s) addNotification('info', 'Schedule Cancelled', `"${s.label}" has been cancelled.`);
  }, [scheduledPayments, addNotification, userId]);

  // ── Internal: execute a single scheduled payment ───────────────────────────
  const executeScheduleInternal = useCallback((sched, silent = false) => {
    const amt   = sched.amount;
    const today = todayStr();
    const rec   = RECURRENCE[sched.recurrence];
    const hasMoreRuns = rec?.days && (!sched.endDate || advanceDate(sched.nextRunDate, rec.days) <= sched.endDate);

    if (sched.paymentType === 'pocket' && sched.toPocketId) {
      const hasFunds = sched.pocketId
        ? pockets.find(p => p.id === sched.pocketId)?.balance >= amt
        : walletBalance >= amt;

      if (!hasFunds) {
        if (!silent) addNotification('warning', 'Schedule Failed', `Insufficient funds for "${sched.label}".`);
        return {
          ...sched,
          status:      rec?.days ? 'upcoming' : 'failed',
          nextRunDate: rec?.days ? advanceDate(sched.nextRunDate, rec.days) : sched.nextRunDate,
          execCount:   sched.execCount + 1,
        };
      }

      if (sched.pocketId) {
        setPockets(prev => prev.map(p => {
          if (p.id !== sched.pocketId) return p;
          const newBal = Math.max(0, p.balance - amt);           // clamp: never negative
          const tx = { id: `t${Date.now()}`, type: 'debit', amount: amt, date: today, description: `Scheduled → ${sched.toPocketName}`, status: 'completed' };
          if (userId) { sync(dbUpdatePocket(p.id, { balance: newBal })); sync(dbAddTransaction(userId, p.id, tx)); }
          return { ...p, balance: newBal, transactions: [tx, ...p.transactions] };
        }));
      } else {
        const newWalletBal = Math.max(0, walletBalance - amt);   // clamp: never negative
        setWalletBalance(newWalletBal);
        if (userId) sync(dbUpdateWalletBalance(userId, newWalletBal));
      }

      setPockets(prev => prev.map(p => {
        if (p.id !== sched.toPocketId) return p;
        const newBal = p.balance + amt;
        const tx = { id: `t${Date.now()}a`, type: 'credit', amount: amt, date: today, description: `Scheduled from ${sched.pocketName}`, status: 'completed' };
        if (userId) { sync(dbUpdatePocket(p.id, { balance: newBal })); sync(dbAddTransaction(userId, p.id, tx)); }
        return { ...p, balance: newBal, transactions: [tx, ...p.transactions] };
      }));

    } else if (sched.pocketId) {
      const src = pockets.find(p => p.id === sched.pocketId);
      if (!src || src.balance < amt) {
        if (!silent) addNotification('warning', 'Schedule Failed', `Insufficient funds in "${sched.pocketName}" for "${sched.label}".`);
        return {
          ...sched,
          status:      rec?.days ? 'upcoming' : 'failed',
          nextRunDate: rec?.days ? advanceDate(sched.nextRunDate, rec.days) : sched.nextRunDate,
          execCount:   sched.execCount + 1,
        };
      }
      setPockets(prev => prev.map(p => {
        if (p.id !== sched.pocketId) return p;
        const newBal = Math.max(0, p.balance - amt);             // clamp: never negative
        const label  = sched.paymentType === 'bank'
          ? `Scheduled Bank Transfer to ****${(sched.recipient || '').slice(-4)}`
          : `Scheduled UPI → ${sched.recipient}`;
        const tx = { id: `t${Date.now()}`, type: 'debit', amount: amt, date: today, description: label, status: 'completed' };
        if (userId) { sync(dbUpdatePocket(p.id, { balance: newBal })); sync(dbAddTransaction(userId, p.id, tx)); }
        return { ...p, balance: newBal, transactions: [tx, ...p.transactions] };
      }));
    }

    if (!silent) addNotification('success', 'Scheduled Payment Executed', `₹${amt.toLocaleString('en-IN')} · "${sched.label}" completed.`);

    const updatedSched = hasMoreRuns
      ? { ...sched, execCount: sched.execCount + 1, status: 'upcoming', nextRunDate: advanceDate(sched.nextRunDate, rec.days) }
      : { ...sched, execCount: sched.execCount + 1, status: 'completed' };

    if (userId) sync(dbUpdateScheduledPayment(sched.id, { status: updatedSched.status, nextRunDate: updatedSched.nextRunDate, execCount: updatedSched.execCount }));
    return updatedSched;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pockets, walletBalance, addNotification, userId]);

  const runScheduleNow = useCallback((id) => {
    setScheduledPayments(prev => prev.map(s => s.id === id ? executeScheduleInternal(s, false) : s));
  }, [executeScheduleInternal]);

  // ── Derived data ──────────────────�