import { createApp } from 'vue';
import Header from '../components/Header.vue';
import FormInscription from '../components/FormInscription.vue';
createApp({
    components: { Header, FormInscription },
    template: `
    <Header />
    <h1>Inscription</h1>
    <FormInscription />
  `
}).mount('#app');
