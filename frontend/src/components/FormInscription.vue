<template>
  <form @submit.prevent="register">
    <div>
      <label>Email</label>
      <input v-model="email" type="email" required />
    </div>
    <div>
      <label>Mot de passe</label>
      <input v-model="password" type="password" required />
    </div>
    <button type="submit">S'inscrire</button>
    <p v-if="error" style="color:red">{{ error }}</p>
  </form>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import api from '../services/api'

export default defineComponent({
  name: 'FormInscription',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')

    const register = async () => {
      try {
        await api.post('/register', {
          email: email.value,
          password: password.value
        })
        error.value = ''
        alert('Inscription réussie ✅')
        window.location.href = '/connexion.html'
      } catch (err: any) {
        error.value = err.response?.data?.message || 'Erreur inscription ❌'
      }
    }

    return { email, password, error, register }
  }
})
</script>