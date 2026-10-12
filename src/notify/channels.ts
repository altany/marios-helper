import { Platform } from 'react-native';
import { Settings } from '../model/types';
import notifee, { AndroidImportance, AndroidVisibility } from './driver';

// Android channels can't be changed after they are created (the user owns them),
// so a new id is needed whenever their sound/importance should change.
export const CH_DOSE = 'dose-v1';
export const CH_DOSE_BARK = 'dose-bark-v1';
export const CH_DOSE_QUIET = 'dose-quiet-v1';
export const CH_WAIT = 'countdown-v1';
export const CH_DONE = 'done-v1';

/** Channels of the previous app version. */
const OLD_CHANNELS = ['medication-alerts-v2', 'medication-alerts', 'expo_notifications_fallback_notification_channel'];

/** The channel for a dose notification with sound: barking or the phone's usual sound. */
export const doseChannel = (settings: Settings) => (settings.bark ? CH_DOSE_BARK : CH_DOSE);

const DOSE_VIBRATION = [300, 400, 200, 400, 200, 600];

export const createChannels = async () => {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CH_DOSE_BARK,
    name: 'Ώρα για φάρμακο (γάβγισμα)',
    description: 'Η ειδοποίηση για κάθε δόση, με γάβγισμα και δόνηση.',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'bark',
    vibration: true,
    vibrationPattern: DOSE_VIBRATION,
    lights: true,
    bypassDnd: true,
  });
  await notifee.createChannel({
    id: CH_DOSE,
    name: 'Ώρα για φάρμακο',
    description: 'Η ειδοποίηση για κάθε δόση, με ήχο και δόνηση.',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    vibrationPattern: DOSE_VIBRATION,
    lights: true,
    bypassDnd: true,
  });
  await notifee.createChannel({
    id: CH_DOSE_QUIET,
    name: 'Δόση σε αναμονή (αθόρυβα)',
    description: 'Όταν σβήσεις μια ειδοποίηση χωρίς να απαντήσεις, ξαναεμφανίζεται εδώ χωρίς ήχο.',
    importance: AndroidImportance.LOW,
    visibility: AndroidVisibility.PUBLIC,
    vibration: false,
  });
  await notifee.createChannel({
    id: CH_WAIT,
    name: 'Αντίστροφη μέτρηση',
    description: 'Δείχνει πόσο μένει μέχρι το επόμενο φάρμακο μιας σειράς.',
    importance: AndroidImportance.LOW,
    visibility: AndroidVisibility.PUBLIC,
    vibration: false,
  });
  await notifee.createChannel({
    id: CH_DONE,
    name: 'Μπράβο',
    description: 'Όταν δοθούν όλα τα φάρμακα της μέρας. Χωρίς ήχο.',
    importance: AndroidImportance.DEFAULT,
    visibility: AndroidVisibility.PUBLIC,
    vibration: false,
  });
};

/** Removes what the previous app version left behind. Safe to run more than once. */
export const cleanupOldVersion = async () => {
  if (Platform.OS !== 'android') return;
  const channels = await notifee.getChannels();
  for (const ch of channels) {
    if (OLD_CHANNELS.includes(ch.id)) await notifee.deleteChannel(ch.id);
  }
};
