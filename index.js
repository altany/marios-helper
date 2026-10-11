// Entry point. The notification background handler must be registered while the
// JS bundle loads, so it also runs when Android starts the app headless (for
// example when "Το έδωσα" is tapped on the notification while the app is closed).
import './src/notify/background';
import 'expo-router/entry';
