import { describe, expect, it } from 'vitest';
import { levelLabel, scoreMessage } from './api';

describe('levelLabel', () => {
  it('met une majuscule au niveau', () => {
    expect(levelLabel('facile')).toBe('Facile');
    expect(levelLabel('difficile')).toBe('Difficile');
  });
});

describe('scoreMessage', () => {
  it('annonce un nouveau record', () => {
    expect(scoreMessage({ points: 325, best: 325, isRecord: true })).toBe('Score enregistré ✓ Nouveau record : 325 points !');
  });

  it('rappelle le record quand il n’est pas battu', () => {
    expect(scoreMessage({ points: 200, best: 325, isRecord: false })).toBe('Score enregistré ✓ Ton record : 325 points.');
  });

  it('précise le niveau pour un jeu à niveaux', () => {
    expect(scoreMessage({ points: 600, best: 600, isRecord: true }, 'facile')).toBe('Score enregistré ✓ Nouveau record en Facile : 600 points !');
  });
});
