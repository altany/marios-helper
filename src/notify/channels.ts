import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility } from './driver';

// Android channels can't be changed after they are created (the user owns them),
// so a new id is needed whenever their sound/importance should change.
export const CH_DOSE = 'dose-v1';
export const CH_DOSE_QUIET = 'dose-quiet-v1';
export const CH_WAIT = 'countdown-v1';

/** Channels of the previous app version. */
const OLD_CHANNELS = ['medication-alerts-v2', 'medication-alerts', 'expo_notifications_fallback_notification_channel'];

export const createChannels = async () => {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CH_DOSE,
    name: 'Ώρα για φάρμακο',
    description: 'Η ειδοποίηση για κάθε δόση, με ήχο και δόνηση.',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 400, 200, 400, 200, 600],
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
};

/** Removes what the previous app version left behind. Safe to run more than once. */
export const cleanupOldVersion = async () => {
  if (Platform.OS !== 'android') return;
  const channels = await notifee.getChannels();
  for (const ch of channels) {
    if (OLD_CHANNELS.includes(ch.id)) await notifee.deleteChannel(ch.id);
  }
};
