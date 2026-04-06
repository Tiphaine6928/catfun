<template>
  <form @submit.prevent="login">
    <div>
      <label>Email</label>
      <input v-model="email" type="email" required />
    </div>
    <div>
      <label>Mot de passe</label>
      <input v-model="password" type="password" required />
    </div>
    <button type="submit">Se connecter</button>
    <p v-if="error" style="color:red">{{ error }}</p>
  </form>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import api from '../services/api'

export default defineComponent({
  name: 'FormConnexion',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')

    const login = async () => {
      try {
        await api.post('/login', {
          email: email.value,
          password: password.value
        })
        error.value = ''
        alert('Connexion réussie ✅')
        window.location.href = '/profil.html'
      } catch (err: any) {
        error.value = 'Email ou mot de passe incorrect ❌'
      }
    }

    return { email, password, error, login }
  }
})
</script>