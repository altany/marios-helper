const NO_TONOS: Record<string, string> = {
  ά: 'α',
  έ: 'ε',
  ή: 'η',
  ί: 'ι',
  ό: 'ο',
  ύ: 'υ',
  ώ: 'ω',
  ΐ: 'ϊ',
  ΰ: 'ϋ',
  Ά: 'Α',
  Έ: 'Ε',
  Ή: 'Η',
  Ί: 'Ι',
  Ό: 'Ο',
  Ύ: 'Υ',
  Ώ: 'Ω',
};

/** Greek capitals are written without accents: "ΤΩΡΑ", not "ΤΏΡΑ". */
export const caps = (text: string) => text.replace(/[άέήίόύώΐΰΆΈΉΊΌΎΏ]/g, ch => NO_TONOS[ch]).toUpperCase();
