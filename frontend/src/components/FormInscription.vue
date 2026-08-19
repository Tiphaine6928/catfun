<template>
  <div class="form-container">
    <h1>Inscription</h1>

    <form @submit.prevent="handleSubmit">

      <!-- Pseudo -->
      <div class="form-group">
        <label for="pseudo">Pseudo</label>
        <input
          type="text"
          id="pseudo"
          v-model="form.pseudo"
          placeholder="Ton pseudo"
          required
        />
      </div>

      <!-- Email -->
      <div class="form-group">
        <label for="email">Email</label>
        <input
          type="email"
          id="email"
          v-model="form.email"
          placeholder="Ton email"
          required
        />
      </div>

      <!-- Password -->
      <div class="form-group">
        <label for="password">Mot de passe</label>
        <input
          type="password"
          id="password"
          v-model="form.password"
          placeholder="Ton mot de passe"
          required
        />
      </div>

      <!-- Affichage erreur -->
      <p v-if="error" class="error">
        {{ error }}
      </p>

      <!-- Bouton -->
      <div class="form-btn-container">
        <button type="submit" class="btn-primary">
          S'inscrire
        </button>
      </div>

      <p class="register-link">
        Déjà inscrit ?
        <a href="/connexion.html">Connectez-vous</a>
      </p>

    </form>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue';
import api from '../services/api'; // ⚠️ chemin vers api.ts

export default {
  setup() {
    const form = ref({
      pseudo: '',
      email: '',
      password: ''
    });

    const error = ref('');

    const handleSubmit = async () => {
      console.log('CLICK 🔥'); // <--- test si le submit est déclenché

      try {
        const res = await api.post('/api/register', form.value);
        console.log(res.data);
        alert('Inscription réussie ✅');
        error.value = '';
        // redirection vers page connexion
        window.location.href = '/connexion.html';
      } catch (err: any) {
        console.error(err);
        error.value = err.response?.data?.error || 'Erreur lors de l’inscription';
      }
    };

    return { form, handleSubmit, error };
  }
};
</script>