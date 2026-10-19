#!/usr/bin/env bash
# Puts the current code on the phone. Run by .github/workflows/deploy.yml.
#
#  - Only JavaScript changed → publish an over-the-air update (EAS Update).
#    The app downloads it by itself, nothing to install.
#  - Native code changed (new native library, permissions, app.json…) → make a
#    new APK (EAS Build) that has to be installed once on the phone.
#
# Which of the two is decided by the "fingerprint" of the native code: if there
# is already a build with the same fingerprint, an update is enough.
set -euo pipefail

PROFILE=preview # build profile in eas.json that is installed on the phone
CHANNEL=preview # its update channel (eas.json → build.preview.channel)

say() {
  echo "$*"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$*" >>"$GITHUB_STEP_SUMMARY"; fi
}

message=$(git log -1 --pretty=%s)
fingerprint=$(npx expo-updates fingerprint:generate --platform android | jq -r .hash)
echo "Native fingerprint: $fingerprint"

existing=$(eas build:list --platform android --build-profile "$PROFILE" --runtime-version "$fingerprint" \
  --status finished --limit 1 --json --non-interactive)

if [ "$(jq length <<<"$existing")" -gt 0 ]; then
  echo "A build with this native code exists ($(jq -r '.[0].id' <<<"$existing")): publishing an update."
  eas update --branch "$CHANNEL" --platform android --message "$message" --non-interactive
  say "### ✅ Νέα ενημέρωση: $message"
  say "Δεν χρειάζεται εγκατάσταση. Η εφαρμογή την κατεβάζει μόνη της όταν την ανοίξεις."
  exit 0
fi

echo "No build with this native code yet: starting a new build."
./scripts/build-apk.sh "$PROFILE" "$message"
