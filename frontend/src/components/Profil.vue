<template>
  <main class="profil-page">

    <h1>Mon profil</h1>

    <div v-if="loading">
      Chargement...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="profil-card">

      <div class="profil-info">
        <label>Pseudo</label>
        <p>{{ pseudo }}</p>
      </div>

      <div class="profil-info">
        <label>Email</label>
        <p>{{ email }}</p>
      </div>

    </div>

  </main>
</template>

<script lang="ts">
import api from '../services/api';

export default {
  data() {
    return {
      pseudo: '',
      email: '',
      loading: true,
      error: ''
    };
  },

  async mounted() {
    try {
      const response = await api.get('/me');

      console.log('Réponse /api/me :', response.data);

      this.pseudo = response.data.user.pseudo;
      this.email = response.data.user.email;

      console.log('Pseudo :', this.pseudo);
      console.log('Email :', this.email);

    } catch (error: any) {

      console.error('Erreur récupération profil :', error);

      if (error.response?.status === 401) {
        this.error = 'Vous devez être connecté pour accéder à votre profil.';
      } else {
        this.error = 'Impossible de récupérer votre profil.';
      }

    } finally {
      this.loading = false;
    }
  }
};
</script>