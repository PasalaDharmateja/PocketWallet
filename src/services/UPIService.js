/**
 * UPIService.js — PocketWallet
 *
 * Full UPI integration:
 *  • Razorpay Standard Checkout (gateway — cards, UPI, wallets, netbanking)
 *  • UPI Intent deep-links (open any installed UPI app directly)
 *  • VPA / IFSC validation
 *  • QR-code parser
 *  • Transaction status constants
 *  • Bank handle reference
 *
 * ── SETUP ────────────────────────────────────────────────────────────────────
 *  npm install react-native-razorpay expo-camera expo-barcode-scanner expo-clipboard
 *
 *  Replace RAZORPAY_KEY_ID & BACKEND_BASE_URL below.
 *  Get your Razorpay keys at: https://dashboard.razorpay.com/app/keys
 */

import { Linking, Platform } from 'react-native';

// ── Config (replace these) ────────────────────────────────────────────────────
export const RAZORPAY_KEY_ID  = 'rzp_test_XXXXXXXXXXXXXXXX';
export const MERCHANT_NAME    = 'PocketWallet';
export const MERCHANT_UPI_ID  = 'pocketwallet@razorpay';
export const BACKEND_BASE_URL = 'https://your-backend.com';

// ── UPI App Registry ──────────────────────────────────────────────────────────
export const UPI_APPS = [
  { id: 'gpay',      name: 'Google Pay',  color: '#4285F4', androidPkg: 'com.google.android.apps.nbu.paisa.user', iosScheme: 'gpay://'       },
  { id: 'phonepe',   name: 'PhonePe',     color: '#5F259F', androidPkg: 'com.phonepe.app',                        iosScheme: 'phonepe://'    },
  { id: 'paytm',     name: 'Paytm',       color: '#002970', androidPkg: 'net.one97.paytm',                        iosScheme: 'paytmmp://'    },
  { id: 'bhim',      name: 'BHIM',        color: '#006341', androidPkg: 'in.org.npci.upiapp',                     iosScheme: 'bhim://'       },
  { id: 'amazonpay', name: 'Amazon Pay',  color: '#FF9900', androidPkg: 'in.amazon.mShop.android.shopping',       iosScheme: 'amznmobile://' },
  { id: 'cred',      name: 'CRED',        color: '#1C1C1E', androidPkg: 'com.dreamplug.androidapp',               iosScheme: 'credapp://'    },
];

// ── Transaction Status ────────────────────────────────────────────────────────
export const TX_STATUS = {
  IDLE: 'IDLE', PENDING: 'PENDING', SUCCESS: 'SUCCESS',
  FAILED: 'FAILED', CANCELLED: 'CANCELLED', TIMEOUT: 'TIMEOUT',
};

// ── Validation ────────────────────────────────────────────────────────────────
export const validateVPA = (vpa = '') => {
  const v = vpa.trim().toLowerCase();
  if (!v) return { valid: false, error: 'Enter a UPI ID' };
  if (!/^[a-zA-Z0-9._-]{2,50}@[a-zA-Z]{2,20}$/.test(v))
    return { valid: false, error: 'Invalid UPI ID (e.g. name@okaxis)' };
  return { valid: true, vpa: v };
};

export const validateIFSC = (ifsc = '') => {
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase()))
    return { valid: false, error: 'Invalid IFSC — format: ABCD0123456' };
  return { valid: true };
};

export const phoneToVPACandidates = (phone) => {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 10) return [];
  return [`${d}@paytm`, `${d}@ybl`, `${d}@okhdfcbank`, `${d}@okaxis`, `${d}@okicici`, `${d}@oksbi`];
};

// ── Deep Link Builder ─────────────────────────────────────────────────────────
export const genTxRef = () =>
  `PW${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const buildUPIUrl = ({ payeeVpa, payeeName, amount, txRef, note = '' }) =>
  `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${Number(amount).toFixed(2)}&tr=${encodeURIComponent(txRef)}&tn=${encodeURIComponent(note || 'PocketWallet Payment')}&cu=INR&mc=0000`;

export const openUPIApp = async (upiUrl, appId = null) => {
  try {
    const app = appId ? UPI_APPS.find(a => a.id === appId) : null;
    if (Platform.OS === 'android' && app?.androidPkg) {
      const intentUrl = upiUrl.replace('upi://', 'intent://') +
        `#Intent;package=${app.androidPkg};scheme=upi;end`;
      await Linking.openURL(intentUrl);
      return { ok: true };
    }
    const canOpen = await Linking.canOpenURL(upiUrl);
    if (!canOpen) return { ok: false, error: 'No UPI app found on this device.' };
    await Linking.openURL(upiUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Failed to open UPI app.' };
  }
};

export const getInstalledUPIApps = async () => {
  const found = [];
  for (const app of UPI_APPS) {
    try {
      const scheme = Platform.OS === 'ios' ? app.iosScheme : 'upi://pay';
      if (await Linking.canOpenURL(scheme)) found.push(app);
    } catch (_) {}
  }
  return found.length ? found : UPI_APPS;
};

// ── QR Parser ─────────────────────────────────────────────────────────────────
export const parseUPIQR = (raw = '') => {
  try {
    const s = raw.trim();
    if (!s.startsWith('upi://') && /^[^@]+@[^@]+$/.test(s))
      return { payeeVpa: s, payeeName: '', amount: null, note: '' };
    if (!s.startsWith('upi://')) return null;
    const url = new URL(s);
    return {
      payeeVpa:  url.searchParams.get('pa') || '',
      payeeName: url.searchParams.get('pn') || '',
      amount:    url.searchParams.get('am') ? parseFloat(url.searchParams.get('am')) : null,
      note:      url.searchParams.get('tn') || '',
      txRef:     url.searchParams.get('tr') || '',
    };
  } catch (_) { return null; }
};

// ── Razorpay Checkout ─────────────────────────────────────────────────────────
export const openRazorpayCheckout = async ({ amount, description, name, email, phone, prefillVpa, orderId }) => {
  let RazorpayCheckout;
  try { RazorpayCheckout = require('react-native-razorpay').default; }
  catch (_) { return { ok: false, error: 'Razorpay not installed.\nRun: npm install react-native-razorpay' }; }

  try {
    const data = await RazorpayCheckout.open({
      key: RAZORPAY_KEY_ID,
      amount: Math.round(amount * 100),
      currency: 'INR',
      name: MERCHANT_NAME,
      description: description || 'PocketWallet Payment',
      order_id: orderId,
      prefill: { name, email, contact: phone, vpa: prefillVpa },
      theme: { color: '#4F46E5' },
      method: { upi: true, card: true, wallet: true, netbanking: true },
      upi: { flow: 'intent' },
      modal: { confirm_close: true },
    });
    return { ok: true, paymentId: data.razorpay_payment_id, orderId: data.razorpay_order_id, signature: data.razorpay_signature };
  } catch (err) {
    if (err?.code === 0) return { ok: false, cancelled: true };
    return { ok: false, error: err?.description || err?.message || 'Payment failed' };
  }
};

export const createRazorpayOrder = async (amountRupees, receipt) => {
  try {
    const resp = await fetch(`${BACKEND_BASE_URL}/api/create-order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPaise: Math.round(amountRupees * 100), receipt }),
    });
    const json = await resp.json();
    return { ok: true, orderId: json.orderId };
  } catch (e) { return { ok: false, error: 'Server unreachable: ' + e.message }; }
};

// ── UPI Response Parser ───────────────────────────────────────────────────────
export const parseUPIResponse = (url = '') => {
  try {
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    const status = (p.Status || p.status || '').toUpperCase();
    if (status === 'SUCCESS' || p.responseCode === '00')
      return { status: TX_STATUS.SUCCESS, txnId: p.txnId, txnRef: p.txnRef };
    if (status === 'FAILURE' || status === 'FAILED')
      return { status: TX_STATUS.FAILED, error: 'Declined by bank' };
    return { status: TX_STATUS.PENDING };
  } catch (_) { return { status: TX_STATUS.FAILED }; }
};

// ── Bank Handle Reference ─────────────────────────────────────────────────────
export const BANK_HANDLES = [
  { h: '@okaxis',     b: 'Axis Bank'           }, { h: '@okicici',    b: 'ICICI Bank'          },
  { h: '@oksbi',      b: 'State Bank of India' }, { h: '@okhdfcbank', b: 'HDFC Bank'           },
  { h: '@ybl',        b: 'Yes Bank / PhonePe'  }, { h: '@paytm',      b: 'Paytm Payments Bank' },
  { h: '@apl',        b: 'Amazon Pay'          }, { h: '@ibl',        b: 'IDFC First Bank'     },
  { h: '@kotak',      b: 'Kotak Mahindra'      }, { h: '@rbl',        b: 'RBL Bank'            },
  { h: '@federal',    b: 'Federal Bank'        }, { h: '@axisbank',   b: 'Axis Bank'           },
  { h: '@hdfcbank',   b: 'HDFC Bank'           }, { h: '@sbi',        b: 'SBI'                 },
  { h: '@icici',      b: 'ICICI Bank'          }, { h: '@hdfc',       b: 'HDFC Bank'           },
];

export const bankFromVPA = (vpa = '') => {
  const handle = '@' + (vpa.split('@')[1] || '').toLowerCase();
  return BANK_HANDLES.find(x => x.h === handle)?.b ?? null;
};
