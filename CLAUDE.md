# Mario's Helper

Expo (SDK 57, React Native 0.86, New Architecture) app that reminds the owner to give her dog Mario his medicines. UI text is Greek and English: write every text in both, in place, with `t('…', '…')` from `src/i18n` (the app follows the phone's language; Ρυθμίσεις → Γλώσσα overrides it). Keep both simple and plain. See README.md for features and code layout.

## Checks

```bash
npm test            # engine + notification flow tests
npm run typecheck
```

The screens can be previewed in a browser with `npx expo export -p web` (notifications are stubbed on web).

## How changes reach the phone

The owner asks for changes from her phone, so shipping must not need a laptop.

- Work on a branch, open a PR. When it is merged into `main`, `.github/workflows/deploy.yml` runs `scripts/deploy.sh`.
- If only JavaScript changed, it publishes an EAS Update (channel `preview`). The app downloads it by itself and shows "Υπάρχει νέα έκδοση" on the Today screen.
- If native code changed (the native fingerprint differs), it makes a new APK with EAS Build (profile `preview`) and puts the install link in the run summary. Tell the owner she has to install it.
- To try a change with native code on the phone first, add the label `test-build` to the PR (ask the owner first: each run is one EAS build). It makes the separate app "Mario TEST" (`APP_VARIANT=test` in `app.config.js`, profile `test`), which installs next to the real one.
- After merging, check the "Deploy to phone" run with the GitHub tools. If it fails, read the job log: `deploy.sh` prints the end of the EAS build log there.

Things that change the native fingerprint and so force a new install: `app.json`, `app.config.js`, `eas.json`, `.gitignore`, `plugins/`, `package.json` scripts, adding or upgrading a package with native code. Avoid touching them for JS-only changes. Don't bump `expo.version` for JS-only changes.

## Notes

- Notifications use `react-native-notify-kit`, the maintained fork of Notifee with the same API (imported only in `src/notify/driver.ts`). Notification texts use plain words (no ✓ or ′), in both languages, so they show on the owner's Garmin watch. On Android Notifee reads titles, texts and button labels as HTML: use `<br>` for new lines, `<b>`/`<i>` if needed, and `esc()` in `src/notify/content.ts` for the user's own words.
- Dose notifications bark by default (`assets/sounds/bark.ogg`, copied into `res/raw` by `plugins/withNotificationSound.js`; channel `dose-bark-v1`). The sound is a synthesised "woof woof" made for this app (no licence to worry about); the owner may later send a recording of Mario to replace it. A channel's sound can't change after it exists, so a new sound needs a new file name and channel id, and any change under `assets/sounds/` or `plugins/` means a new APK install. Ρυθμίσεις → «Γάβγισμα» switches back to the phone's usual sound without an install.
- All schedule logic is pure TypeScript in `src/engine/` with tests in `__tests__/`; every data change goes through `act()` in `src/notify/commands.ts`, which also re-syncs the alarms.
- Physio (daily exercises and visits to the physio) is separate from medicines: `src/engine/physio.ts`, `app/physio.tsx`, `src/ui/physio.tsx`. Its notification ids are `physio|YYYY-MM-DD` and `appt|<id>`. Each day's entry in `physio.done` is an object so it can later hold more (e.g. which exercises, how many).
- The look is dog themed: Mario's colours in `src/ui/theme.ts` (cream, caramel, red bandana) and paw prints. Titles and medicine names use the rounded font via the `rounded` style; it is a Latin + Greek subset of M PLUS Rounded 1c ExtraBold in `assets/fonts/` (OFL), so keep `fontWeight` normal with it.
