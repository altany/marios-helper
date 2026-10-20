// Copies the notification sounds in assets/sounds/ into the Android app
// (res/raw), so a notification channel can use them, e.g. sound: 'woof'.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withNotificationSound(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const from = path.join(cfg.modRequest.projectRoot, 'assets/sounds');
      const to = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/raw');
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) {
        if (/^[a-z0-9_]+\.(ogg|mp3|wav)$/.test(file)) fs.copyFileSync(path.join(from, file), path.join(to, file));
      }
      return cfg;
    },
  ]);
};
