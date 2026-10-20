import { t } from '../i18n';
import { addDays, atTime, dateKey, MINUTE } from '../lib/time';
import { defaultData, MED_COLORS } from '../model/defaults';
import { AppData } from '../model/types';
import { markStep } from './actions';
import { markPhysio, saveAppointment, setPhysioDaily } from './physio';
import { runsForDay } from './runs';

// Made-up data for the browser preview, so the screens can be tried without a
// phone: Mario's kind of schedule with made-up medicine names, a week already
// given, and today given up to half an hour ago. Pure, like the rest of the engine.

/** Doses due at least this long ago count as given; later ones are left for the visitor to tap. */
const OPEN_FOR_MIN = 30;

export const demoData = (now: number): AppData => {
  const today = dateKey(now);
  const data = defaultData();
  const since = atTime(addDays(today, -30), '00:00');

  data.meds = [
    { id: 'blinkdrops', name: 'Blinkdrops', kind: 'drops', dose: t('1 σταγόνα σε κάθε μάτι', '1 drop in each eye'), notes: '', color: MED_COLORS[0] },
    {
      id: 'tearshield',
      name: 'Tearshield',
      kind: 'ointment',
      dose: t('Ένας κόκκος ρυζιού στο αριστερό μάτι', 'A rice grain in the left eye'),
      notes: t('Μετά απαλό μασάζ στο βλέφαρο.', 'Then gently massage the eyelid.'),
      color: MED_COLORS[2],
    },
    { id: 'pawmol', name: 'Pawmol', kind: 'pill', dose: t('1/4 του δισκίου', '1/4 tablet'), notes: t('Με λίγο φαγητό.', 'With a little food.'), color: MED_COLORS[4] },
  ];
  data.routines = [
    {
      id: 'eyes',
      name: t('Μάτια', 'Eyes'),
      times: ['09:00', '21:00'],
      days: [],
      steps: [
        { id: 'eyes-1', medId: 'blinkdrops', waitMin: 0 },
        { id: 'eyes-2', medId: 'tearshield', waitMin: 20 },
      ],
      enabled: true,
      createdAt: since,
      fromGiven: false,
    },
    {
      id: 'midday',
      name: t('Μάτια (μεσημέρι)', 'Eyes (midday)'),
      times: ['15:00'],
      days: [],
      steps: [{ id: 'midday-1', medId: 'blinkdrops', waitMin: 0 }],
      enabled: true,
      createdAt: since,
      fromGiven: false,
    },
    {
      id: 'painkiller',
      name: t('Παυσίπονο', 'Painkiller'),
      times: ['07:00', '15:00', '23:00'],
      days: [],
      steps: [{ id: 'painkiller-1', medId: 'pawmol', waitMin: 0 }],
      enabled: true,
      createdAt: since,
      fromGiven: true,
    },
  ];
  data.prescription = {
    vetName: t('Δρ. Ελένη Κ.', 'Dr Helen K.'),
    vetPhone: '',
    nextVisit: addDays(today, 10),
    notes: t(
      'Ξηροφθαλμία στο αριστερό μάτι. Συνέχεια θεραπείας και επανέλεγχος.',
      'Dry eye in the left eye. Keep up the treatment, then a check-up.',
    ),
  };

  // The last week given a few minutes late, as in real life; today up to half an hour ago.
  for (let d = -7; d <= 0; d++) {
    const day = addDays(today, d);
    const until = d === 0 ? now - OPEN_FOR_MIN * MINUTE : Infinity;
    for (let guard = 0; guard < 100; guard++) {
      const next = runsForDay(data, day, now)
        .flatMap(run => run.steps.map(step => ({ run, step })))
        .filter(({ step }) => step.status !== 'given' && step.status !== 'skipped' && step.status !== 'waiting')
        .filter(({ step }) => step.dueAt <= until)
        .sort((a, b) => a.step.dueAt - b.step.dueAt)[0];
      if (!next) break;
      markStep(data, next.run.id, next.step.index, 'given', next.step.dueAt + 3 * MINUTE);
    }
  }

  // Physio most evenings for four weeks, and a visit coming up.
  setPhysioDaily(data, true, addDays(today, -27));
  for (let d = -27; d < 0; d++) {
    if (d === -20 || d === -13 || d === -6) continue;
    const day = addDays(today, d);
    markPhysio(data, day, atTime(day, '18:10'));
  }
  saveAppointment(data, {
    id: 'demo-past',
    at: atTime(addDays(today, -6), '17:30'),
    note: t('Πρώτη υδροθεραπεία. Νέα άσκηση: κάθισε-σήκω, 3 φορές την ημέρα.', 'First hydrotherapy. New exercise: sit-to-stand, 3 times a day.'),
  });
  saveAppointment(data, {
    id: 'demo-next',
    at: atTime(addDays(today, 2), '17:30'),
    note: t('Υδροθεραπεία. Φέρε πετσέτα.', 'Hydrotherapy. Bring a towel.'),
  });
  return data;
};
