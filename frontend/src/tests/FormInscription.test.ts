import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FormInscription from '../components/FormInscription.vue';

describe('FormInscription', () => {
  it('contient un champ email', () => {
    const wrapper = mount(FormInscription);

    expect(
      wrapper.find('input[type="email"]').exists()
    ).toBe(true);
  });
});