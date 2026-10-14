import { t } from '../i18n';

/** The vet's first prescription, as it was written in the first version of the app. Always shown in Συνταγή. */
export const firstPrescription = () => ({
  period: t('Ως τέλος Αυγούστου', 'Until the end of August'),
  meds: [
    {
      name: t('Exocin κολλύριο', 'Exocin eye drops'),
      lines: t(['1 σταγόνα × 4 φορές την ημέρα', 'Στο αριστερό μάτι'], ['1 drop × 4 times a day', 'In the left eye']),
    },
    {
      name: t('Hylogel κολλύριο', 'Hylogel eye drops'),
      lines: t(['1 σταγόνα × 4 φορές την ημέρα', 'Και στα δύο μάτια'], ['1 drop × 4 times a day', 'In both eyes']),
    },
    {
      name: t('Lacrimmune αλοιφή', 'Lacrimmune ointment'),
      lines: t(
        ['Ποσότητα ίση με έναν κόκκο ρυζιού', 'Ανά 12ωρο (πρωί + βράδυ)', 'Μέσα στο αριστερό μάτι + μασάζ με το βλέφαρο'],
        ['An amount the size of a grain of rice', 'Every 12 hours (morning + evening)', 'Inside the left eye + massage with the eyelid'],
      ),
    },
  ],
});
