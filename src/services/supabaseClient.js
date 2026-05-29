/**
 * supabaseClient.js
 * Supabase client for PocketWallet — handles all DB reads/writes.
 *
 * Tables:
 *   users              — profile + wallet_balance
 *   pockets            — individual pockets per user
 *   transactions       — credit/debit history per pocket
 *   scheduled_payments — recurring & one-time scheduled payments
 *   notifications      — in-app notification feed
 *
 * ⚠️  Next step: replace the local AuthContext with Supabase Auth
 *     so that Row Level Security (RLS) policies automatically
 *     enforce per-user data isolation via auth.uid().
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://xhawoersxdrjkfkcxjbm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoYXdvZXJzeGRyamtma2N4amJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTI5MTgsImV4cCI6MjA5NTQ4ODkxOH0.uITW7sqrn99bssADxYC1WMq2-b-U1MX_r0wZDrSA2nY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────

/** Look up a user by email. Returns the row or null. */
export const getUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data ?? null;
};

/** Create a new user row. Returns the created row. */
export const createUser = async ({ name, email, phone, passHash, avatar }) => {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      email: email.trim().toLowerCase(),
      phone,
      pass_hash: passHash,
      avatar,
      wallet_balance: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Save / update the PIN hash for a user. */
export const savePinHash = async (userId, pinHash) => {
  const { error } = await supabase
    .from('users')
    .update({ pin_hash: pinHash })
    .eq('id', userId);
  if (error) throw error;
};

/** Update wallet balance for a user. */
export const updateWalletBalance = async (userId, balance) => {
  const { error } = await supabase
    .from('users')
    .update({ wallet_balance: balance })
    .eq('id', userId);
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// POCKETS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all pockets for a user, newest first. */
export const getPockets = async (userId) => {
  const { data, error } = await supabase
    .from('pockets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
};

/** Create a new pocket. Returns the created row. */
export const createPocket = async (userId, { name, balance, priority, color }) => {
  const { data, error } = await supabase
    .from('pockets')
    .insert({ user_id: userId, name, balance, priority, color })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Update pocket fields (name, balance, priority, color). */
export const updatePocket = async (pocketId, updates) => {
  const { error } = await supabase
    .from('pockets')
    .update(updates)
    .eq('id', pocketId);
  if (error) throw error;
};

/** Delete a pocket (cascades to its transactions). */
export const deletePocket = async (pocketId) => {
  const { error } = await supabase
    .from('pockets')
    .delete()
    .eq('id', pocketId);
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all transactions for a pocket, newest first. */
export const getTransactions = async (pocketId) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('pocket_id', pocketId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

/** Fetch all transactions for a user (across all pockets). */
export const getAllTransactions = async (userId) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

/** Insert a new transaction. Returns the created row. */
export const addTransaction = async (userId, pocketId, { type, amount, date, description, status }) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      pocket_id: pocketId ?? null,
      type,
      amount,
      date,
      description,
      status: status ?? 'completed',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all scheduled payments for a user. */
export const getScheduledPayments = async (userId) => {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

/** Create a new scheduled payment. Returns the created row. */
export const createScheduledPayment = async (userId, schedule) => {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .insert({
      user_id:        userId,
      label:          schedule.label,
      payment_type:   schedule.paymentType,
      recipient:      schedule.recipient      ?? null,
      ifsc:           schedule.ifsc           ?? null,
      to_pocket_id:   schedule.toPocketId     ?? null,
      to_pocket_name: schedule.toPocketName   ?? null,
      amount:         schedule.amount,
      pocket_id:      schedule.pocketId       ?? null,
      pocket_name:    schedule.pocketName     ?? 'Wallet',
      recurrence:     schedule.recurrence     ?? 'once',
      scheduled_date: schedule.scheduledDate,
      scheduled_time: schedule.scheduledTime  ?? '09:00:00',
      status:         'upcoming',
      note:           schedule.note           ?? '',
      exec_count:     0,
      next_run_date:  schedule.scheduledDate,
      end_date:       schedule.endDate        ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Update a scheduled payment (status, next_run_date, exec_count, etc.). */
export const updateScheduledPayment = async (scheduleId, updates) => {
  // Map camelCase keys used in the app to snake_case DB columns
  const mapped = {};
  if (updates.status        !== undefined) mapped.status         = updates.status;
  if (updates.nextRunDate   !== undefined) mapped.next_run_date  = updates.nextRunDate;
  if (updates.execCount     !== undefined) mapped.exec_count     = updates.execCount;
  if (updates.scheduledDate !== undefined) mapped.scheduled_date = updates.scheduledDate;
  if (updates.scheduledTime !== undefined) mapped.scheduled_time = updates.scheduledTime;
  if (updates.amount        !== undefined) mapped.amount         = updates.amount;
  if (updates.note          !== undefined) mapped.note           = updates.note;
  if (updates.label         !== undefined) mapped.label          = updates.label;
  if (updates.endDate       !== undefined) mapped.end_date       = updates.endDate;

  const { error } = await supabase
    .from('scheduled_payments')
    .update(mapped)
    .eq('id', scheduleId);
  if (error) throw error;
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all notifications for a user, newest first. */
export const getNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

/** Insert a new notification. */
export const addNotification = async (userId, { type, title, message }) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, message, read: false })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Mark all notifications as read for a user. */
export const markAllNotificationsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);
  if (error) throw error;
};

/** Delete a single notification. */
export const deleteNotification = async (notifId) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notifId);
  if (error) throw error;
};

/** Delete all notifications for a user. */
export const clearAllNotifications = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
};
