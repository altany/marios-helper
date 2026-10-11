# Mario's Helper

Expo (SDK 51) app that reminds the owner to give her dog Mario his medicines. UI text is Greek; keep it simple and plain. See README.md for features and code layout.

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
- After merging, check the "Deploy to phone" run with the GitHub tools. If it fails, read the job log: `deploy.sh` prints the end of the EAS build log there.

Things that change the native fingerprint and so force a new install: `app.json`, `eas.json`, `.gitignore`, `plugins/`, `package.json` scripts, adding or upgrading a package with native code. Avoid touching them for JS-only changes. Don't bump `expo.version` for JS-only changes.

## Notes

- Notifications use Notifee (`src/notify/driver.ts`). Notification texts use plain words (no ✓ or ′) so they show on the owner's Garmin watch.
- All schedule logic is pure TypeScript in `src/engine/` with tests in `__tests__/`; every data change goes through `act()` in `src/notify/commands.ts`, which also re-syncs the alarms.
