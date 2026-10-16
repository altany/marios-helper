// The app's settings are in app.json. With APP_VARIANT=test (the "test" build
// profile in eas.json) it becomes a separate app, "Mario TEST", that installs
// next to the real one. New versions can be tried on the phone without
// touching Mario's real reminders.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'test') return config;
  return {
    ...config,
    name: 'Mario TEST',
    android: { ...config.android, package: 'com.altany.marioshelper.test' },
    ios: { ...config.ios, bundleIdentifier: 'com.altany.marioshelper.test' },
  };
};
