<template>
  <div class="form-container">
    <h1>Connexion</h1>

    <form @submit.prevent="handleSubmit">
      <!-- Email -->
      <div>
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
      <div>
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
      <p v-if="error" class="text-red-500">{{ error }}</p>

      <!-- Bouton -->
      <button type="submit">Se connecter</button>
    </form>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue';
import api from '../services/api'; // ⚠️ chemin vers ton api.ts

export default {
  setup() {
    const form = ref({
      email: '',
      password: ''
    });

    const error = ref('');

    const handleSubmit = async () => {
      console.log('CLICK 🔥 login');

      try {
        const res = await api.post('/api/login', form.value);
        console.log(res.data);

        alert('Connexion réussie ✅');
        error.value = '';

        // Redirection vers la page profil
        window.location.href = '/profil.html';
      } catch (err: any) {
        console.error(err);
        error.value = err.response?.data?.error || 'Identifiants invalides';
      }
    };

    return { form, handleSubmit, error };
  }
};
</script>

<style scoped>
.form-container {
  max-width: 400px;
  margin: auto;
  padding: 1rem;
}
input {
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}
button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.text-red-500 {
  color: red;
}
</style>