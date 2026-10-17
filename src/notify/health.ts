import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from '../i18n';
import { getData } from '../store/store';
import { ACCENT } from '../ui/theme';
import { cleanupOldVersion, createChannels, doseChannel } from './channels';
import {
  ACTION_GIVE,
  ACTION_PHYSIO_DONE,
  ACTION_PHYSIO_LATER,
  ACTION_SNOOZE,
  IOS_CATEGORY,
  IOS_CATEGORY_PHYSIO,
} from './content';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
  TriggerType,
} from './driver';
import { TEST_NOTIFICATION_ID } from './events';
import { log } from './log';
import { alarmType, scheduledCount, syncNotifications } from './sync';

const CLEANUP_KEY = 'marios-helper/cleanup-v4';

/** Runs once when the app opens: permissions, channels, tidy-up and first sync. */
export const setupNotifications = async () => {
  void log('app opened');
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
          { id: ACTION_GIVE, title: t('Το έδωσα', 'I gave it') },
          { id: ACTION_SNOOZE, title: t('Αργότερα', 'Later') },
        ],
      },
      {
        id: IOS_CATEGORY_PHYSIO,
        actions: [
          { id: ACTION_PHYSIO_DONE, title: t('Έγινε', 'Done') },
          { id: ACTION_PHYSIO_LATER, title: t('Αργότερα', 'Later') },
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
  await syncNotifications('app opened');
};

export type Check = {
  key: string;
  /** Says how things are now, e.g. "Η μπαταρία περιορίζει την εφαρμογή" (the battery limits the app). */
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
    label: allowed
      ? t('Οι ειδοποιήσεις επιτρέπονται', 'Notifications are allowed')
      : t('Οι ειδοποιήσεις δεν επιτρέπονται', 'Notifications are not allowed'),
    ok: allowed,
    help: allowed
      ? t('Εντάξει.', 'All good.')
      : t(
          'Χωρίς αυτή την άδεια δεν εμφανίζεται καμία ειδοποίηση. Πάτα «Άνοιγμα» και επέτρεψέ τες.',
          'Without this permission no reminder can show. Tap "Open" and allow them.',
        ),
    fix: () => notifee.openNotificationSettings(),
    fixLabel: t('Άνοιγμα', 'Open'),
  });

  if (Platform.OS === 'android') {
    const channel = doseChannel((await getData()).settings);
    const channelOn = !(await notifee.isChannelBlocked(channel));
    checks.push({
      key: 'channel',
      label: channelOn
        ? t('Οι ειδοποιήσεις φαρμάκων είναι ανοιχτές', 'Medicine reminders are on')
        : t('Οι ειδοποιήσεις φαρμάκων είναι κλειστές', 'Medicine reminders are off'),
      ok: channelOn,
      help: t(
        'Εδώ ρυθμίζεις και τον ήχο ή αν περνάει το «Μην ενοχλείτε».',
        'This is also where you set the sound, and whether reminders get through Do Not Disturb.',
      ),
      fix: () => notifee.openNotificationSettings(channel),
      fixLabel: t('Ήχος & ρυθμίσεις', 'Sound & settings'),
    });

    if (settings.android.alarm !== AndroidNotificationSetting.NOT_SUPPORTED) {
      const exact = settings.android.alarm === AndroidNotificationSetting.ENABLED;
      checks.push({
        key: 'alarm',
        label: exact
          ? t('Οι ειδοποιήσεις έρχονται στην ακριβή ώρα', 'Reminders come at the exact time')
          : t('Οι ειδοποιήσεις μπορεί να αργούν', 'Reminders may come late'),
        ok: exact,
        help: exact
          ? t('Εντάξει.', 'All good.')
          : t(
              'Λείπει η άδεια «Ξυπνητήρια και υπενθυμίσεις». Χωρίς αυτή, το κινητό μπορεί να τις καθυστερήσει μερικά λεπτά.',
              'The "Alarms & reminders" permission is missing. Without it, the phone may delay reminders by a few minutes.',
            ),
        fix: () => notifee.openAlarmPermissionSettings(),
        fixLabel: t('Άνοιγμα', 'Open'),
      });
    }

    const batteryLimited = await notifee.isBatteryOptimizationEnabled();
    checks.push({
      key: 'battery',
      label: batteryLimited
        ? t('Η εξοικονόμηση μπαταρίας περιορίζει την εφαρμογή', 'Battery saving limits the app')
        : t('Η μπαταρία δεν περιορίζει την εφαρμογή', 'Battery saving doesn\'t limit the app'),
      ok: !batteryLimited,
      help: batteryLimited
        ? t(
            'Πάτα «Άνοιγμα». Αν δεις τον διακόπτη «Επιτρέψτε τη χρήση στο παρασκήνιο», πάτα πάνω στα γράμματά του (όχι στον διακόπτη) και διάλεξε «Χωρίς περιορισμούς». Αν δεις λίστα, διάλεξε «Χωρίς περιορισμούς». Αλλιώς το κινητό μπορεί να καθυστερεί ή να μη στέλνει τις ειδοποιήσεις.',
            'Tap "Open". If you see the switch "Allow background usage", tap its words (not the switch) and choose "Unrestricted". If you see a list, choose "Unrestricted". Otherwise the phone may delay reminders or not send them at all.',
          )
        : t('Εντάξει.', 'All good.'),
      fix: () => notifee.openBatteryOptimizationSettings(),
      fixLabel: t('Άνοιγμα', 'Open'),
    });

    const power = await notifee.getPowerManagerInfo();
    if (power.activity) {
      checks.push({
        key: 'power',
        label: t(
          `Ρυθμίσεις ${power.manufacturer ?? 'κατασκευαστή'} (για σιγουριά)`,
          `${power.manufacturer ?? 'Phone maker'} settings (to be safe)`,
        ),
        ok: null,
        help: t(
          'Κάποια κινητά (Samsung, OnePlus, Xiaomi κ.ά.) έχουν και δική τους εξοικονόμηση, που δεν μπορώ να ελέγξω. Αν υπάρχει, επέτρεψε στην εφαρμογή να τρέχει στο παρασκήνιο.',
          'Some phones (Samsung, OnePlus, Xiaomi and others) have their own battery saving, which the app can\'t check. If yours does, allow the app to run in the background.',
        ),
        fix: () => notifee.openPowerManagerSettings(),
        fixLabel: t('Άνοιγμα', 'Open'),
      });
    }
  }

  const count = await scheduledCount();
  checks.push({
    key: 'scheduled',
    label: t(`Προγραμματισμένες ειδοποιήσεις: ${count}`, `Scheduled reminders: ${count}`),
    ok: count > 0,
    help:
      count > 0
        ? t('Οι επόμενες ειδοποιήσεις είναι έτοιμες.', 'The next reminders are ready.')
        : t('Καμία προγραμματισμένη ειδοποίηση. Πάτα «Συγχρονισμός».', 'No reminders scheduled. Tap "Sync".'),
    fix: () => syncNotifications('«Συγχρονισμός» button'),
    fixLabel: t('Συγχρονισμός', 'Sync'),
  });

  return checks;
};

/** Shows a test reminder after a few seconds, so you can check sound and buttons. */
export const sendTestNotification = async (seconds = 5) => {
  const { settings } = await getData();
  await notifee.createTriggerNotification(
    {
      id: TEST_NOTIFICATION_ID,
      title: t(`Ώρα για το φάρμακο, ${settings.petName}!`, `Time for the medicine, ${settings.petName}!`),
      subtitle: t('Δοκιμή', 'Test'),
      body: t(
        '<b>Δοκιμαστική ειδοποίηση</b><br>Έτσι θα φαίνεται η ειδοποίηση για κάθε φάρμακο.',
        '<b>Test reminder</b><br>This is how the reminder for each medicine will look.',
      ),
      android: {
        channelId: doseChannel(settings),
        category: AndroidCategory.REMINDER,
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_stat_paw',
        largeIcon: require('../../assets/images/mario-avatar.png'),
        circularLargeIcon: true,
        color: ACCENT,
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [{ title: t('Εντάξει', 'OK'), pressAction: { id: 'ok' } }],
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
