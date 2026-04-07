<template>
  <div v-if="user">
    <h2>Bienvenue, {{ user.pseudo }}</h2>
    <p>Email : {{ user.email }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import api from '../services/api'

interface User {
  email: string
}

export default defineComponent({
  name: 'Profil',
  setup() {
    const user = ref<User | null>(null)

    const fetchUser = async () => {
      try {
        const res = await api.get('/api/me')
        user.value = res.data
      } catch {
        alert('Vous devez vous connecter !')
        window.location.href = '/connexion.html'
      }
    }

    const logout = async () => {
      await api.post('/logout')
      window.location.href = '/accueil.html'
    }

    onMounted(fetchUser)

    return { user, logout }
  }
})
</script>