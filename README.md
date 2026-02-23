# Baby Feed

Track your baby’s feeding: log food types and amounts, view daily/weekly/monthly stats, and set reminders with notifications.

## Run locally

```bash
npm install
npm start
```

Then press `a` for Android or scan the QR code with Expo Go.

## Build APK (installable app)

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Build: `eas build --platform android --profile preview`

The **preview** profile produces an `.apk` you can download from the Expo dashboard and install on your device. For a production build, use `--profile production`.

First-time Android builds may prompt for credentials; EAS can create a keystore for you.

## Features

- **Home**: Round chart of what was eaten (by type and amount), quick-add form, date selector, “Add new variant” button.
- **Statistics**: Daily / weekly / monthly totals and chart.
- **Food types**: Add, edit, delete food variants (name, unit, color).
- **Reminders**: Add reminders with time; get pop-up notifications (daily at that time).

Data is stored only on the device (AsyncStorage).
