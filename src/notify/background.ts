import notifee from './driver';
import { handleEvent } from './events';

// Registered when the JS bundle loads (imported first from index.js).
notifee.onBackgroundEvent(event => handleEvent(event, false));
