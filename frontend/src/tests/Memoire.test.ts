import { describe, it, expect } from 'vitest';

describe('Mémoire', () => {
  it('possède des cartes', () => {
    const cartes = ['🐱', '🐱', '🐶', '🐶'];

    expect(cartes.length).toBe(4);
  });
});