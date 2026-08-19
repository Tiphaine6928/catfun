<template>
  <div class="form-container">

    <h1>Connexion</h1>

    <form @submit.prevent="handleSubmit">

      <div class="form-group">
        <label for="email">Email</label>

        <input
          id="email"
          v-model="email"
          type="email"
          required
        />
      </div>

      <div class="form-group">
        <label for="password">Mot de passe</label>

        <input
          id="password"
          v-model="password"
          type="password"
          required
        />
      </div>

      <p v-if="error" class="error">
        {{ error }}
      </p>

      <button type="submit">
        Se connecter
      </button>

    </form>

    <p class="register-link">
      Pas encore inscrit ?
      <a href="/inscription.html">Inscrivez-vous</a>
    </p>

  </div>
</template>

<script lang="ts">
import api from '../services/api';

export default {
  data() {
    return {
      email: '',
      password: '',
      error: ''
    };
  },

  methods: {
    async handleSubmit() {
      this.error = '';

      try {
        const response = await api.post('/login_check', {
          email: this.email,
          password: this.password
        });

        console.log('Connexion réussie :', response.data);

        // Récupération du JWT
        const token = response.data.token;

        if (!token) {
          this.error = 'Token de connexion introuvable.';
          return;
        }

        // Stockage du JWT
        localStorage.setItem('token', token);

        console.log('JWT enregistré');

        // Redirection vers le profil
        window.location.href = '/profil.html';

      } catch (error: any) {
        console.error('Erreur connexion :', error);

        if (error.response?.status === 401) {
          this.error = 'Identifiants invalides';
        } else {
          this.error = 'Une erreur est survenue lors de la connexion.';
        }
      }
    }
  }
};
</script>