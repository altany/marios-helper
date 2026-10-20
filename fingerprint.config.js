// The notification sounds are copied into the Android app (plugins/withNotificationSound.js),
// so a new or changed sound must make a new build, not an update the old app can't play.
/** @type {import('expo/fingerprint').Config} */
const config = {
  extraSources: [{ type: 'dir', filePath: 'assets/sounds', reasons: ['notificationSounds'] }],
};

module.exports = config;
