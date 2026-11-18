/** Symboles des cartes, avec le nom lu par les lecteurs d'écran. */
export interface CardSymbol {
  readonly emoji: string;
  readonly label: string;
}

export const SYMBOLS: readonly CardSymbol[] = [
  { emoji: '😺', label: 'chat souriant' },
  { emoji: '😹', label: 'chat qui pleure de rire' },
  { emoji: '😻', label: 'chat amoureux' },
  { emoji: '😼', label: 'chat malicieux' },
  { emoji: '😽', label: 'chat qui fait un bisou' },
  { emoji: '🙀', label: 'chat effrayé' },
  { emoji: '😿', label: 'chat triste' },
  { emoji: '😾', label: 'chat boudeur' },
  { emoji: '🐈', label: 'chat qui marche' },
  { emoji: '🐈‍⬛', label: 'chat noir' },
  { emoji: '🧶', label: 'pelote de laine' },
  { emoji: '🐟', label: 'poisson' },
  { emoji: '🐭', label: 'souris' },
  { emoji: '🥛', label: 'bol de lait' },
  { emoji: '🐾', label: 'empreintes de pattes' },
  { emoji: '🛋️', label: 'canapé griffé' },
];
