# 💰 PocketWallet — React Native App (iOS & Android)

A complete digital wallet app with pocket-based budgeting, UPI payments, bank transfers, monthly reports, and notifications.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- iOS: Xcode + iOS Simulator, or [Expo Go](https://apps.apple.com/app/expo-go/id982107779) on your phone
- Android: Android Studio + Emulator, or [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) on your phone

### Install & Run
```bash
cd PocketWallet
npm install
npx expo start
```
Then press `i` for iOS, `a` for Android, or scan the QR code with Expo Go.

---

## 📱 Features

### 🔐 Security (Lock Screen)
- **PIN authentication** (default PIN: `1234`)
- **Biometric auth** — Face ID (iOS) / Fingerprint (Android)
- **256-bit encryption** for stored data
- Auto-lock on app close

### 💼 Wallet
- Add money via **UPI, Net Banking, Debit/Credit Card, Bank Transfer**
- View total balance split between Wallet and Pockets
- Quick action buttons: Send, Add, Report, Alerts

### 📦 Pockets (1–100)
- Create up to 100 named budget pockets
- **3 priority levels**: High ⭐⭐⭐, Medium ⭐⭐, Low ⭐
- Tap priority badge to cycle/change instantly
- Rename and delete pockets
- Move funds between wallet and pockets
- Color-coded with balance progress bar

### 💸 Payments (per Pocket)
| Method | Details |
|--------|---------|
| Scan QR | Camera opens to scan merchant QR |
| UPI Phone | Pay via 10-digit mobile number |
| UPI ID | Pay via UPI handle (user@bank) |
| Bank Transfer | Account number + IFSC code |

All payments include optional remarks, quick-amount buttons (₹100/500/1000/2000), and a success confirmation screen.

### 📊 Monthly Report
- Navigate between months with arrows
- Summary: Total received, spent, transaction count
- Net balance card (green = saved, red = overspent)
- Daily spending bar chart
- Per-pocket breakdown with spending share % bars
- Full transaction list per pocket

### 🔔 Notifications & Alerts
Auto-generated for every action:
- ✅ Wallet topped up
- ✅ Funds allocated to pocket
- ℹ️ Funds returned to wallet
- ✅ UPI payment sent
- ℹ️ Bank transfer initiated
- ℹ️ Pocket created / deleted
- ⚠️ Low wallet balance (< ₹500)
- ⚠️ Low pocket balance (< ₹200)

Features: Mark all read, dismiss individual, clear all, unread badge on tab bar.

---

## 🏗️ Project Structure
```
PocketWallet/
├── App.js                          # Navigation root
├── app.json                        # Expo config
├── package.json
├── babel.config.js
└── src/
    ├── context/
    │   └── WalletContext.js        # Global state + all business logic
    ├── screens/
    │   ├── LockScreen.js           # PIN + Biometric auth
    │   ├── HomeScreen.js           # Wallet + Pocket list
    │   ├── PocketDetailScreen.js   # Pocket page with payments
    │   ├── PaymentScreen.js        # UPI/Bank payment flow
    │   ├── ReportScreen.js         # Monthly analytics
    │   └── NotificationsScreen.js  # Alerts & notifications
    ├── components/
    │   └── PocketCard.js           # Reusable pocket card
    └── utils/
        └── theme.js                # Colors, spacing, shadows
```

---

## 🏦 Build for Production

### iOS (App Store)
```bash
npx eas build --platform ios
```

### Android (Play Store)
```bash
npx eas build --platform android
```

Requires [EAS CLI](https://docs.expo.dev/build/setup/) and an Expo account.

---

## 🔧 Customization

- **Change default PIN**: Edit `savedPin` in `LockScreen.js`
- **Change low balance thresholds**: Edit values in `WalletContext.js`
- **Add more pocket colors**: Edit `POCKET_COLORS` array in `WalletContext.js`
- **Add more months**: Edit `MONTHS` array in `ReportScreen.js`

---

## 📄 Tech Stack

| Library | Purpose |
|---------|---------|
| Expo SDK 51 | Build toolchain |
| React Navigation 6 | Stack + Tab navigation |
| expo-linear-gradient | Gradient UI |
| expo-haptics | Haptic feedback |
| expo-local-authentication | Face ID / Fingerprint |
| expo-secure-store | Secure key storage |
| AsyncStorage | Data persistence |
| @expo/vector-icons (Ionicons) | Icons |
