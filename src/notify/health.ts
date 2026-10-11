import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getData } from '../store/store';
import { cleanupOldVersion, CH_DOSE, createChannels } from './channels';
import { ACTION_GIVE, ACTION_SNOOZE, IOS_CATEGORY } from './content';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
  TriggerType,
} from './driver';
import { TEST_NOTIFICATION_ID } from './events';
import { alarmType, scheduledCount, syncNotifications } from './sync';

const CLEANUP_KEY = 'marios-helper/cleanup-v4';

/** Runs once when the app opens: permissions, channels, tidy-up and first sync. */
export const setupNotifications = async () => {
  await getData(); // loads (and migrates) the data first
  try {
    await notifee.requestPermission();
  } catch (e) {
    console.warn('Permission request failed', e);
  }
  await createChannels();
  if (Platform.OS === 'ios') {
    await notifee.setNotificationCategories([
      {
        id: IOS_CATEGORY,
        actions: [
          { id: ACTION_GIVE, title: '✓ Το έδωσα' },
          { id: ACTION_SNOOZE, title: 'Αργότερα' },
        ],
      },
    ]);
  }
  if (!(await AsyncStorage.getItem(CLEANUP_KEY))) {
    // First start after the update: remove the old app's notifications and channels.
    await notifee.cancelAllNotifications();
    await cleanupOldVersion();
    await AsyncStorage.setItem(CLEANUP_KEY, String(Date.now()));
  }
  await syncNotifications();
};

export type Check = {
  key: string;
  label: string;
  ok: boolean;
  help: string;
  fix?: () => Promise<void>;
  fixLabel?: string;
};

/** Everything that can stop reminders from arriving on time, with a way to fix it. */
export const runChecks = async (): Promise<Check[]> => {
  if (Platform.OS === 'web') return [];
  const checks: Check[] = [];
  const settings = await notifee.getNotificationSettings();

  checks.push({
    key: 'permission',
    label: 'Άδεια για ειδοποιήσεις',
    ok: settings.authorizationStatus === AuthorizationStatus.AUTHORIZED,
    help: 'Χωρίς αυτή δεν εμφανίζεται καμία ειδοποίηση.',
    fix: () => notifee.openNotificationSettings(),
    fixLabel: 'Άνοιγμα',
  });

  if (Platform.OS === 'android') {
    checks.push({
      key: 'channel',
      label: 'Ειδοποιήσεις φαρμάκων ενεργές',
      ok: !(await notifee.isChannelBlocked(CH_DOSE)),
      help: 'Εδώ ρυθμίζεις και τον ήχο ή αν περνάει το «Μην ενοχλείτε».',
      fix: () => notifee.openNotificationSettings(CH_DOSE),
      fixLabel: 'Ήχος & ρυθμίσεις',
    });

    if (settings.android.alarm !== AndroidNotificationSetting.NOT_SUPPORTED) {
      checks.push({
        key: 'alarm',
        label: 'Ακριβής ώρα (ξυπνητήρια)',
        ok: settings.android.alarm === AndroidNotificationSetting.ENABLED,
        help: 'Χωρίς αυτή, το κινητό μπορεί να καθυστερήσει τις ειδοποιήσεις μερικά λεπτά.',
        fix: () => notifee.openAlarmPermissionSettings(),
        fixLabel: 'Άνοιγμα',
      });
    }

    const batteryOptimized = await notifee.isBatteryOptimizationEnabled();
    checks.push({
      key: 'battery',
      label: 'Χωρίς περιορισμό μπαταρίας',
      ok: !batteryOptimized,
      help: 'Διάλεξε «Χωρίς περιορισμούς» για την εφαρμογή, αλλιώς το κινητό μπορεί να την κλείνει.',
      fix: () => notifee.openBatteryOptimizationSettings(),
      fixLabel: 'Άνοιγμα',
    });

    const power = await notifee.getPowerManagerInfo();
    if (power.activity) {
      checks.push({
        key: 'power',
        label: `Ρυθμίσεις ${power.manufacturer ?? 'κατασκευαστή'}`,
        ok: true,
        help: 'Κάποια κινητά (Samsung, OnePlus, Xiaomi κ.ά.) έχουν δική τους εξοικονόμηση. Επέτρεψε στην εφαρμογή να τρέχει στο παρασκήνιο.',
        fix: () => notifee.openPowerManagerSettings(),
        fixLabel: 'Άνοιγμα',
      });
    }
  }

  const count = await scheduledCount();
  checks.push({
    key: 'scheduled',
    label: `Προγραμματισμένες ειδοποιήσεις: ${count}`,
    ok: count > 0,
    help:
      count > 0 ? 'Οι επόμενες ειδοποιήσεις είναι έτοιμες.' : 'Καμία προγραμματισμένη ειδοποίηση. Πάτα «Συγχρονισμός».',
    fix: syncNotifications,
    fixLabel: 'Συγχρονισμός',
  });

  return checks;
};

/** Shows a test reminder after a few seconds, so you can check sound and buttons. */
export const sendTestNotification = async (seconds = 5) => {
  const { settings } = await getData();
  await notifee.createTriggerNotification(
    {
      id: TEST_NOTIFICATION_ID,
      title: `${settings.petName} · Δοκιμή`,
      body: 'Έτσι θα φαίνεται η ειδοποίηση για κάθε φάρμακο.',
      android: {
        channelId: CH_DOSE,
        category: AndroidCategory.REMINDER,
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_stat_paw',
        largeIcon: require('../../assets/images/mario-avatar.png'),
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [{ title: 'Εντάξει', pressAction: { id: 'ok' } }],
        loopSound: settings.insistent,
      },
      ios: { sound: 'default' },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000,
      alarmManager: { type: await alarmType() },
    },
  );
};
