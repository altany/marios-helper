#!/usr/bin/env bash
# Makes an APK with EAS Build and puts the install link in the GitHub run summary.
# Used by deploy.sh (profile "preview", the real app) and by the "Test build"
# workflow (profile "test", the separate "Mario TEST" app).
#
#   scripts/build-apk.sh <profile> <message>
set -euo pipefail

PROFILE=$1
message=$2

say() {
  echo "$*"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$*" >>"$GITHUB_STEP_SUMMARY"; fi
}

set +e
eas build --platform android --profile "$PROFILE" --message "$message" --non-interactive --wait
status=$?
set -e

build=$(eas build:list --platform android --build-profile "$PROFILE" --limit 1 --json --non-interactive | jq '.[0]')
id=$(jq -r .id <<<"$build")
page="https://expo.dev/accounts/$(jq -r .app.ownerAccount.name <<<"$build")/projects/$(jq -r .app.slug <<<"$build")/builds/$id"

if [ $status -ne 0 ] || [ "$(jq -r .status <<<"$build")" != "FINISHED" ]; then
  echo "::error::Build failed: $(jq -r '.error.message // "unknown error"' <<<"$build")"
  echo "Build page: $page"
  # Print the end of the build logs here, so they can be read from GitHub.
  for url in $(jq -r '.logFiles[]?' <<<"$build"); do
    echo "----- log -----"
    curl -sSL "$url" | jq -r '.msg? // empty' 2>/dev/null | tail -n 300 || true
  done
  say "### ❌ Η δημιουργία της εφαρμογής απέτυχε"
  say "[Λεπτομέρειες στο Expo]($page)"
  exit 1
fi

apk=$(jq -r .artifacts.applicationArchiveUrl <<<"$build")
say "### 📦 Νέα έκδοση για εγκατάσταση: $message"
say "Άνοιξε τη σελίδα από το κινητό και πάτα «Install»:"
say ""
say "- Σελίδα: $page"
say "- Κατευθείαν το APK: $apk"
