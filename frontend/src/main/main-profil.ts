import { createApp } from 'vue'
import Header from '../components/Header.vue'
import Profil from '../components/Profil.vue'

const app = createApp({})
app.component('Header', Header)
app.component('Profil', Profil)
app.mount('#app')