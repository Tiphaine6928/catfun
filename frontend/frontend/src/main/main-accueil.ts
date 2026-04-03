import { createApp } from 'vue'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'

const App = {
  components: { Header, Footer },
  template: `
    <Header />
    <h1>Bienvenue sur le site !</h1>
    <Footer />
  `
}

createApp(App).mount('#app')