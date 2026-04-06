<template>
  <div>
    <h2>Profil</h2>
    <p v-if="!user">Chargement du profil...</p>
    <div v-else>
      <p><strong>Email:</strong> {{ user.email }}</p>
      <button @click="logout">Se déconnecter</button>
    </div>
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