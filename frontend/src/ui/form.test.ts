import { describe, expect, it } from 'vitest';
import { safeRedirect, validatePseudo } from './form';

describe('validatePseudo', () => {
  it('accepte lettres (accents compris), chiffres, tiret et tiret bas', () => {
    expect(validatePseudo('Félix-le_Chat69')).toBeNull();
    expect(validatePseudo('  Minou  ')).toBeNull();
  });

  it('refuse un pseudo vide, trop court ou trop long', () => {
    expect(validatePseudo('   ')).toBe('Merci de choisir un pseudo.');
    expect(validatePseudo('ab')).toContain('au moins 3');
    expect(validatePseudo('a'.repeat(31))).toContain('au plus 30');
    expect(validatePseudo('a'.repeat(30))).toBeNull();
  });

  it('compte les caractères accentués comme un seul caractère', () => {
    expect(validatePseudo('éé')).toContain('au moins 3');
    expect(validatePseudo('é'.repeat(30))).toBeNull();
  });

  it('refuse les espaces et les caractères spéciaux', () => {
    expect(validatePseudo('Minou 69')).toContain('ne peut contenir que');
    expect(validatePseudo('<script>')).toContain('ne peut contenir que');
  });
});

describe('safeRedirect', () => {
  it('accepte un chemin interne', () => {
    expect(safeRedirect('/pendu')).toBe('/pendu');
    expect(safeRedirect('/classement')).toBe('/classement');
  });

  it('renvoie à l’accueil pour une adresse externe, vide ou exclue', () => {
    expect(safeRedirect('https://pirate.example')).toBe('/');
    expect(safeRedirect('/x?y=<z>')).toBe('/');
    expect(safeRedirect(null)).toBe('/');
    expect(safeRedirect('/login', ['/login'])).toBe('/');
  });
});
