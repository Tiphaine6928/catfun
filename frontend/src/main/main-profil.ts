import { createApp } from 'vue'
import Header from '../components/Header.vue'
import Profil from '../components/Profil.vue'

createApp({
  components: { Header, Profil },
  template: `
    <Header />
    <h1>Profil</h1>
    <Profil />
  `
}).mount('#app')