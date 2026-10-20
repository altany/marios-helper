#!/usr/bin/env bash
# Puts the newest real app (build profile "preview") on a GitHub release, so it
# can always be downloaded from the same link, also after EAS deletes the build
# (it keeps them for up to 90 days):
#
#   https://github.com/altany/marios-helper/releases/latest/download/marios-helper.apk
#
# Run by .github/workflows/release-apk.yml after each "Deploy to phone". Safe to
# run more than once: a build that already has a release is skipped.
set -euo pipefail

build=$(eas build:list --platform android --build-profile preview --status finished --limit 1 --json --non-interactive |
  jq '.[0] // empty')
if [ -z "$build" ]; then
  echo "No finished build yet."
  exit 0
fi

id=$(jq -r .id <<<"$build")
tag="build-${id:0:8}"
if gh release view "$tag" >/dev/null 2>&1; then
  echo "Build $id is already on the release $tag."
  exit 0
fi

version=$(jq -r .appVersion <<<"$build")
day=$(date -u -d "$(jq -r .completedAt <<<"$build")" +'%-d %b %Y')
commit=$(jq -r '.gitCommitHash // empty' <<<"$build")
curl -fsSL -o marios-helper.apk "$(jq -r '.artifacts.applicationArchiveUrl // .artifacts.buildUrl' <<<"$build")"

gh release create "$tag" marios-helper.apk ${commit:+--target "$commit"} --latest \
  --title "Mario's Helper $version ($day)" \
  --notes "The Android app. On the phone, download marios-helper.apk below and open it to install."

link="https://github.com/$GITHUB_REPOSITORY/releases/latest/download/marios-helper.apk"
echo "Released $tag: $link"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### 📦 Το APK είναι και στο GitHub"
    echo "Μόνιμο link για την πιο νέα έκδοση: $link"
  } >>"$GITHUB_STEP_SUMMARY"
fi
