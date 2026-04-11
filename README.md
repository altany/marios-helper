# Mario's Helper 🐕 💊

Meet Mario, my adorable furry friend who needs a bit of extra care! This app manages Mario's daily medication schedule - multiple eye drops at specific times, with timed chains between them and some painkiller.

<div align="center">
  <img src="https://github.com/user-attachments/assets/5eac1eae-370d-4c6e-ae34-c27cc136c2dd" height="600" alt="Mario">
</div>

## Features

- **Scheduled notifications** - daily reminders at configurable times, with sound and vibration
- **Medication chains** - after taking one medication, a follow-up notification fires after a configurable delay (e.g. Lacrimmune 20 min after Hylogel)
- **N-step chains** - chains can have multiple steps, each with its own delay and selectable hours
- **Per-step hour control** - each chain step only shows the hours that are actually reachable from the previous step
- **Fully customisable settings** - add/remove medications, adjust times, configure chains, all without touching code
- **Truly sticky notifications** - notifications cannot be dismissed by swiping; if the OEM allows swipe-dismiss (OnePlus, Samsung etc.), a `BroadcastReceiver` immediately re-posts the full notification including action buttons
- **In-app modal** - when a notification fires while the app is open, a non-dismissable modal appears instead of the system banner
- **Snooze** - scrollable picker for snooze duration (5 min – 2 hours)
- **Schedule summary** - the notifications tab shows a live preview of the full medication schedule
- **Light/dark mode** — respects the device colour scheme

## For Developers

### Install dependencies

```bash
npm install
```

This will also apply the `patch-package` patch to expo-notifications automatically via the `postinstall` script.

### Run in development

```bash
npx expo start
```

### Build APK (Android)

```bash
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`
