import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Pendu from '../components/Pendu.vue';

describe('Pendu', () => {
  it('affiche le titre du jeu', () => {
    const wrapper = mount(Pendu);

    expect(wrapper.text()).toContain('Jeu du Pendu');
  });

  it('contient un champ de saisie', () => {
    const wrapper = mount(Pendu);

    expect(wrapper.find('input').exists()).toBe(true);
  });
});