# Mario's Helper 🐕 💊

Meet Mario, my adorable furry friend who needs a bit of extra care! This app reminds us to give Mario his medicines on time: eye drops, ointments and painkillers, some of them one after the other with a wait in between.

<div align="center">
  <img src="https://github.com/user-attachments/assets/5eac1eae-370d-4c6e-ae34-c27cc136c2dd" height="600" alt="Mario">
</div>

## What it does

- **Σήμερα (Today)** – what is due now, with big "Το έδωσα" / "Αργότερα" buttons, the next medicine, and the whole day. Go back to see what was given, or forward to see (and change) the coming days.
- **Chains of medicines** – a routine is a list of medicines given one after the other, e.g. *Hylogel → 20′ → Lacrimmune*. The next reminder comes 20 minutes after you tap "Το έδωσα", not 20 minutes after the planned time. A quiet countdown shows how long is left.
- **Change one reminder only** – tap any future dose to move it to another time just that day, skip it, or put it back. "Αλλαγή ώρας για όλη τη μέρα" moves every dose of a day at once (e.g. when you woke up late).
- **Sticky notifications** – a reminder stays until you tap "Το έδωσα" or "Αργότερα". If it is swiped away it comes back quietly. If nobody answers it rings again every few minutes (you choose how often, up to 6 times), then stays quietly in the drawer. It only goes away by itself when the dose counts as missed (after 12 hours by default).
- **No duplicates** – each medicine of each dose has one notification id, so pressing a button twice (e.g. phone and watch) can't create extra reminders.
- **Pause** – one switch stops all reminders (e.g. while Mario stays at the vet) without changing the schedule.
- **Buttons work with the app closed** – "Το έδωσα" and "Αργότερα" on the notification (or on a smartwatch) work without opening the app, and the next medicine of the chain is scheduled right away.
- **Πρόγραμμα (Schedule)** – a preview of a normal day, the list of routines, and the next reminders.
- **Συνταγή (Prescription)** – the medicines with dose and instructions, treatment start/end dates (no reminders after the end), the vet's phone and next check-up, and free notes.
- **Ρυθμίσεις (Settings)** – pause, snooze time, repeat time, when a dose counts as missed, sticky on/off, countdown, alarm-like sound, plus a **check** of everything that can stop reminders from arriving (permissions, exact alarms, battery saving, phone-maker settings) with a button to fix each one, and a test notification.
- **Ιστορικό (History)** – the last 30 days, and how many doses were given.
- **Backup** – export all data as text and restore it later.
- Light and dark mode. Settings from the previous version are carried over on the first start, and the old "Οδηγίες" text is kept in the prescription notes.
- Notification texts use plain words (no ✓ or ′ symbols) so they show correctly on a smartwatch.

## How it works (for developers)

- Expo SDK 51 + expo-router. Notifications use [Notifee](https://github.com/invertase/notifee) (`@notifee/react-native`).
  Notifee was archived in April 2026; its maintained fork [`react-native-notify-kit`](https://github.com/marcocrupi/react-native-notify-kit) has the same API but needs the New Architecture. To switch, change the import in `src/notify/driver.ts`.
- Instead of repeating alarms, the app works out the concrete doses ("runs") for the next 7 days from the routines (`src/engine/runs.ts`), and schedules one exact alarm per dose. Every change goes through `act()` (`src/notify/commands.ts`), which saves the data and then syncs the alarms with the plan (`src/engine/plan.ts`, `src/notify/sync.ts`). The 7 days are topped up every time the app opens or a notification fires.
- Notification buttons are handled in `src/notify/events.ts`. It is registered in `index.js` so it also runs when Android starts the app in the background.
- All data is one JSON document in AsyncStorage (`src/store/store.ts`).
- The engine is plain TypeScript with tests in `__tests__/`.

```
app/                 screens (expo-router)
src/engine/          schedule logic, no React
src/notify/          notifications (Notifee)
src/store/           saving data
src/model/           types, default data, migration from v2
src/ui/              components, theme, sheets
plugins/             Expo config plugin for the notification icon
```

### Install

```bash
npm install
```

### Checks

```bash
npm test            # engine tests
npm run typecheck   # TypeScript
```

### Run in development

```bash
npx expo start
```

The screens also open in a browser (`npm run web`), but notifications only work on a phone.

### Build the APK (Android)

This version removes the old native files, so the `android/` folder must be generated again once:

```bash
npx expo prebuild --clean -p android
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

If you had changed anything by hand in `android/` (e.g. your own signing key in `android/app/build.gradle`), copy it somewhere first, because `--clean` deletes the folder. An APK signed with a different key can't be installed over the old app without uninstalling it (which also deletes its data).

After installing, open the app once and look at **Ρυθμίσεις → Έλεγχος**. On Samsung / OnePlus / Xiaomi phones, allow the app to run in the background without battery limits.
