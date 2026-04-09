import { createApp } from 'vue'
import Header from '../components/Header.vue'
import FormConnexion from '../components/FormConnexion.vue'
import '../styles.css';

// Monte Header
createApp(Header).mount('#header')

// Monte FormConnexion
createApp(FormConnexion).mount('#form-connexion')