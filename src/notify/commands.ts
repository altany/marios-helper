import { markStep, prune, snoozeStep } from '../engine/actions';
import { markPhysio, snoozePhysio } from '../engine/physio';
import { MINUTE } from '../lib/time';
import { AppData } from '../model/types';
import { update } from '../store/store';
import { syncNotifications } from './sync';

/**
 * Changes the data and then brings the notifications up to date.
 * Every change in the app goes through here.
 */
export const act = async (recipe: (draft: AppData) => void) => {
  const data = await update(draft => {
    recipe(draft);
    prune(draft, Date.now());
  });
  await syncNotifications();
  return data;
};

export const giveStep = (runId: string, index: number, at = Date.now()) =>
  act(d => markStep(d, runId, index, 'given', at));

export const skipStep = (runId: string, index: number) => act(d => markStep(d, runId, index, 'skipped', Date.now()));

export const snoozeStepFor = (runId: string, index: number, minutes: number) =>
  act(d => snoozeStep(d, runId, index, Date.now() + minutes * MINUTE));

export const physioDone = (date: string, at = Date.now()) => act(d => markPhysio(d, date, at));

export const snoozePhysioFor = (date: string, minutes: number) =>
  act(d => snoozePhysio(d, date, Date.now() + minutes * MINUTE));
