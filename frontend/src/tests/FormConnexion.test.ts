import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FormConnexion from '../components/FormConnexion.vue';

describe('FormConnexion', () => {
  it('contient un champ mot de passe', () => {
    const wrapper = mount(FormConnexion);

    expect(
      wrapper.find('input[type="password"]').exists()
    ).toBe(true);
  });
});