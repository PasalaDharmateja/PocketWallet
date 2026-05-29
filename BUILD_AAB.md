# Building PocketWallet .aab for Google Play Store

## Prerequisites (install once)
```bash
npm install -g eas-cli
```

## Step 1 — Login to Expo
```bash
eas login
# Username: dharmatejapasala
# Password: (your Expo account password)
```
> Don't have an Expo account? Create one free at https://expo.dev/signup

## Step 2 — Link to Expo project
```bash
cd PocketWallet
eas init --id pocket-wallet-prod
```

## Step 3 — Build the .aab (cloud build, no Android Studio needed)
```bash
eas build --platform android --profile production
```
This takes ~10-15 minutes. EAS builds it on Expo's cloud servers.
You'll get a download link when done.

## Step 4 — Download your .aab
EAS will print a URL like:
  https://expo.dev/artifacts/eas/xxxx.aab
Download it — this is what you upload to Play Store.

---

## Alternative: Build locally (requires Android Studio)

### Prerequisites
- Android Studio with SDK 34
- Java 17+ (`java -version`)
- Set ANDROID_HOME env variable

### Generate keystore (do once, save the file!)
```bash
keytool -genkey -v \
  -keystore pocketwallet-release.keystore \
  -alias pocketwallet \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Fill in:
#   First/Last name: Dharmateja Pasala
#   Organization: PocketWallet
#   Country: IN
#   Password: (choose strong password, SAVE IT)
```

### Build .aab locally
```bash
cd PocketWallet
npm install
npx expo prebuild --platform android --clean
cd android
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file=../pocketwallet-release.keystore \
  -Pandroid.injected.signing.store.password=YOUR_KEYSTORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=pocketwallet \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD
```

### Find your .aab
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## Upload to Google Play Console

1. Go to https://play.google.com/console
2. Create app → App name: "PocketWallet"
3. App category: Finance
4. Free/Paid: Free
5. Content rating: Fill questionnaire
6. Testing → Internal testing → Create release
7. Upload your .aab file
8. Add release notes:
   ```
   Initial release of PocketWallet — pocket-based budgeting with UPI payments,
   scheduled transfers, and biometric security.
   ```
9. Review → Roll out to Internal testing

## Play Store Listing Details
- **App name**: PocketWallet
- **Short description**: Smart pocket-based budgeting with UPI payments
- **Full description**: (see STORE_LISTING.md)
- **Category**: Finance
- **Package**: com.pocketwallet.app
- **Min Android**: 7.0 (API 24)
- **Target Android**: 14 (API 34)
