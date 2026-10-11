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
          { id: ACTION_GIVE, title: 'Το έδωσα' },
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
  /** Says how things are now, e.g. "Η μπαταρία περιορίζει την εφαρμογή". */
  label: string;
  /** null: nothing to check, just a setting worth a look. */
  ok: boolean | null;
  help: string;
  fix?: () => Promise<void>;
  fixLabel?: string;
};

/** Everything that can stop reminders from arriving on time, with a way to fix it. */
export const runChecks = async (): Promise<Check[]> => {
  if (Platform.OS === 'web') return [];
  const checks: Check[] = [];
  const settings = await notifee.getNotificationSettings();

  const allowed = settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
  checks.push({
    key: 'permission',
    label: allowed ? 'Οι ειδοποιήσεις επιτρέπονται' : 'Οι ειδοποιήσεις δεν επιτρέπονται',
    ok: allowed,
    help: allowed
      ? 'Εντάξει.'
      : 'Χωρίς αυτή την άδεια δεν εμφανίζεται καμία ειδοποίηση. Πάτα «Άνοιγμα» και επέτρεψέ τες.',
    fix: () => notifee.openNotificationSettings(),
    fixLabel: 'Άνοιγμα',
  });

  if (Platform.OS === 'android') {
    const channelOn = !(await notifee.isChannelBlocked(CH_DOSE));
    checks.push({
      key: 'channel',
      label: channelOn ? 'Οι ειδοποιήσεις φαρμάκων είναι ανοιχτές' : 'Οι ειδοποιήσεις φαρμάκων είναι κλειστές',
      ok: channelOn,
      help: 'Εδώ ρυθμίζεις και τον ήχο ή αν περνάει το «Μην ενοχλείτε».',
      fix: () => notifee.openNotificationSettings(CH_DOSE),
      fixLabel: 'Ήχος & ρυθμίσεις',
    });

    if (settings.android.alarm !== AndroidNotificationSetting.NOT_SUPPORTED) {
      const exact = settings.android.alarm === AndroidNotificationSetting.ENABLED;
      checks.push({
        key: 'alarm',
        label: exact ? 'Οι ειδοποιήσεις έρχονται στην ακριβή ώρα' : 'Οι ειδοποιήσεις μπορεί να αργούν',
        ok: exact,
        help: exact
          ? 'Εντάξει.'
          : 'Λείπει η άδεια «Ξυπνητήρια και υπενθυμίσεις». Χωρίς αυτή, το κινητό μπορεί να τις καθυστερήσει μερικά λεπτά.',
        fix: () => notifee.openAlarmPermissionSettings(),
        fixLabel: 'Άνοιγμα',
      });
    }

    const batteryLimited = await notifee.isBatteryOptimizationEnabled();
    checks.push({
      key: 'battery',
      label: batteryLimited
        ? 'Η εξοικονόμηση μπαταρίας περιορίζει την εφαρμογή'
        : 'Η μπαταρία δεν περιορίζει την εφαρμογή',
      ok: !batteryLimited,
      help: batteryLimited
        ? 'Πάτα «Άνοιγμα». Αν δεις τον διακόπτη «Επιτρέψτε τη χρήση στο παρασκήνιο», πάτα πάνω στα γράμματά του (όχι στον διακόπτη) και διάλεξε «Χωρίς περιορισμούς». Αν δεις λίστα, διάλεξε «Χωρίς περιορισμούς». Αλλιώς το κινητό μπορεί να καθυστερεί ή να μη στέλνει τις ειδοποιήσεις.'
        : 'Εντάξει.',
      fix: () => notifee.openBatteryOptimizationSettings(),
      fixLabel: 'Άνοιγμα',
    });

    const power = await notifee.getPowerManagerInfo();
    if (power.activity) {
      checks.push({
        key: 'power',
        label: `Ρυθμίσεις ${power.manufacturer ?? 'κατασκευαστή'} (για σιγουριά)`,
        ok: null,
        help: 'Κάποια κινητά (Samsung, OnePlus, Xiaomi κ.ά.) έχουν και δική τους εξοικονόμηση, που δεν μπορώ να ελέγξω. Αν υπάρχει, επέτρεψε στην εφαρμογή να τρέχει στο παρασκήνιο.',
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
