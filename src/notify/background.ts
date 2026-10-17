import notifee from './driver';
import { handleEvent } from './events';
import { logStart } from './log';

// Registered when the JS bundle loads (imported first from index.js).
void logStart();
notifee.onBackgroundEvent(event => handleEvent(event, false));
