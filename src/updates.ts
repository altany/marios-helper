import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { t } from './i18n';
import { formatDate, dateKey, toHHMM } from './lib/time';

// New versions arrive over the air (EAS Update). Expo checks when the app
// starts; this also checks whenever the app comes back to the front, so a new
// version can be used without fully closing the app.

/** True once a new version has been downloaded and only needs a restart. */
export const useUpdateReady = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          setReady(true);
        }
      } catch (e) {
        console.warn('Update check failed', e);
      } finally {
        busy = false;
      }
    };
    check();
    const sub = AppState.addEventListener('change', state => state === 'active' && check());
    return () => sub.remove();
  }, []);
  return ready;
};

export const restartWithUpdate = () => Updates.reloadAsync();

/** e.g. "ενημέρωση Δευτέρα 12 Οκτ 14:30" (update Monday 12 Oct 14:30), or null when running the installed version. */
export const updateLabel = (): string | null => {
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.createdAt) return null;
  const at = Updates.createdAt.getTime();
  return t(`ενημέρωση ${formatDate(dateKey(at))} ${toHHMM(at)}`, `update ${formatDate(dateKey(at))} ${toHHMM(at)}`);
};
