import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Header from '../components/Header.vue';

describe('Header', () => {
  it('affiche CatFun', () => {
    const wrapper = mount(Header);

    expect(wrapper.text()).toContain('CatFun');
  });
});