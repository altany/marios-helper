import { demoData } from '../src/engine/demo';
import { planPhysio, physioDay, physioStreak, upcomingAppointments } from '../src/engine/physio';
import { dueSteps, runsForDay } from '../src/engine/runs';
import { addDays, atTime, dateKey, MINUTE } from '../src/lib/time';
import { normalize } from '../src/model/migrate';

const DAY = '2026-10-20';
const at = (hhmm: string) => atTime(DAY, hhmm);
const steps = (data: ReturnType<typeof demoData>, day: string, now: number) =>
  runsForDay(data, day, now).flatMap(r => r.steps);

describe('demo data for the browser preview', () => {
  it('has the last week all given', () => {
    const now = at('12:00');
    const data = demoData(now);
    for (let d = -7; d < 0; d++) {
      const all = steps(data, addDays(DAY, d), now);
      expect(all.length).toBe(8);
      expect(all.every(s => s.status === 'given')).toBe(true);
    }
  });

  it('gives today only up to half an hour ago, and leaves the rest to try', () => {
    const now = at('09:10');
    const data = demoData(now);
    const today = steps(data, DAY, now);
    // 07:00 painkiller given; 09:00 Blinkdrops is due now, Tearshield waits for it.
    expect(today.filter(s => s.status === 'given').map(s => s.name)).toEqual(['Pawmol']);
    expect(dueSteps(data, now).map(d => d.step.name)).toEqual(['Blinkdrops']);
    expect(today.every(s => s.markedAt == null || s.markedAt <= now - 25 * MINUTE)).toBe(true);
  });

  it('keeps the chain timed from when the dose was given', () => {
    const now = at('22:00');
    const data = demoData(now);
    const eyes = runsForDay(data, DAY, now).find(r => r.time === '21:00')!;
    expect(eyes.steps[1].dueAt - eyes.steps[0].markedAt!).toBe(20 * MINUTE);
  });

  it('has physio done most days, and a visit coming up', () => {
    const now = at('12:00');
    const data = demoData(now);
    expect(physioStreak(data, now)).toBe(5);
    expect(physioDay(data, DAY, now).status).toBe('upcoming');
    expect(upcomingAppointments(data, now).map(a => dateKey(a.at))).toEqual([addDays(DAY, 2)]);
    expect(planPhysio(data, now, 7).alerts.length).toBeGreaterThan(0);
  });

  it('is valid saved data', () => {
    const data = demoData(at('12:00'));
    expect(normalize(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
});
