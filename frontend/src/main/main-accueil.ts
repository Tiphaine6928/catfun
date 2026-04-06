import { createApp } from 'vue'
import Header from '../components/Header.vue'

const app = createApp({})
app.component('Header', Header)
app.mount('#app') // Assure-toi d'avoir <div id="app"></div> dans accueil.html