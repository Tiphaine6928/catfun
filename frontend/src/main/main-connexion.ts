import { createApp } from 'vue'
import Header from '../components/Header.vue'
import FormConnexion from '../components/FormConnexion.vue'

createApp({
  components: { Header, FormConnexion },
  template: `
    <Header />
    <h1>Connexion</h1>
    <FormConnexion />
  `
}).mount('#app')