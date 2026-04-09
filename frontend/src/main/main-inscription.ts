import { createApp } from 'vue';
import Header from '../components/Header.vue';
import FormInscription from '../components/FormInscription.vue';
import '../styles.css';

createApp(Header).mount('#header')
createApp(FormInscription).mount('#form-inscription')