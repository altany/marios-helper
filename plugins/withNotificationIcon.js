// Adds a white paw-print vector drawable used as the small status-bar icon of
// notifications (Android needs a single-colour icon there).
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const ellipse = (cx, cy, rx, ry) => `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z`;

const PAW = [
  ellipse(12, 15.6, 4.8, 4),
  ellipse(6, 10.4, 1.9, 2.4),
  ellipse(9.5, 6.6, 2, 2.6),
  ellipse(14.5, 6.6, 2, 2.6),
  ellipse(18, 10.4, 1.9, 2.4),
].join(' ');

const XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="${PAW}" />
</vector>
`;

module.exports = function withNotificationIcon(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ic_stat_paw.xml'), XML);
      return cfg;
    },
  ]);
};
