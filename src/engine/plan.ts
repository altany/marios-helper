import { addDays, dateKey, DAY, MINUTE } from '../lib/time';
import { AppData } from '../model/types';
import { listRuns, RunView, StepView } from './runs';

// Works out which notifications should exist right now. The notification layer
// compares this plan with what Android has scheduled/shown and fixes the
// difference, so the plan is the single source of truth.

/** How far ahead alarms are scheduled. Refreshed every time the app or a notification is used. */
export const HORIZON_DAYS = 7;

/** An unanswered reminder rings again at most this many times, then stays quietly in the drawer. */
export const MAX_REPEATS = 6;

export interface PlannedAlert {
  notifId: string;
  run: RunView;
  step: StepView;
  /** When Android should show (or show again) the notification. */
  at: number;
  kind: 'due' | 'repeat';
}

export interface DueNow {
  run: RunView;
  step: StepView;
  /** Last time this step should have alerted (first alert or latest repeat). */
  lastAlertAt: number;
  /** False when sticky is off and the user swiped it away after the last alert. */
  visible: boolean;
}

export interface Countdown {
  notifId: string;
  run: RunView;
  step: StepView;
  /** The medicine given just before. */
  after: StepView;
}

export interface NotificationPlan {
  alerts: PlannedAlert[];
  due: DueNow[];
  countdowns: Countdown[];
}

export const planNotifications = (data: AppData, now: number): NotificationPlan => {
  const { repeatMin, missAfterMin, countdown, sticky } = data.settings;
  const repeat = repeatMin * MINUTE;
  const missAfter = missAfterMin * MINUTE;
  const limit = now + HORIZON_DAYS * DAY;
  const today = dateKey(now);
  const back = Math.ceil(missAfterMin / (24 * 60)) + 1;

  const plan: NotificationPlan = { alerts: [], due: [], countdowns: [] };
  if (data.settings.paused) return plan;

  for (const run of listRuns(data, addDays(today, -back), addDays(today, HORIZON_DAYS), now)) {
    for (const step of run.steps) {
      if (step.status === 'upcoming' && step.dueAt <= limit) {
        plan.alerts.push({ notifId: step.notifId, run, step, at: step.dueAt, kind: 'due' });
        const prev = run.steps[step.index - 1];
        if (countdown && prev?.status === 'given' && !step.snoozed) {
          plan.countdowns.push({ notifId: `${step.notifId}~wait`, run, step, after: prev });
        }
      } else if (step.status === 'due') {
        let lastAlertAt = step.dueAt;
        if (repeat > 0) {
          const k = Math.min(Math.floor((now - step.dueAt) / repeat), MAX_REPEATS);
          lastAlertAt = step.dueAt + k * repeat;
          const next = lastAlertAt + repeat;
          if (k < MAX_REPEATS && next < step.dueAt + missAfter) {
            plan.alerts.push({ notifId: step.notifId, run, step, at: next, kind: 'repeat' });
          }
        }
        const dismissedAt = data.dismissed[step.notifId];
        const visible = sticky || dismissedAt == null || dismissedAt < lastAlertAt;
        plan.due.push({ run, step, lastAlertAt, visible });
      }
    }
  }
  return plan;
};
