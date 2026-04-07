<template>
  <form @submit.prevent="handleSubmit">
    <div>
      <label for="pseudo">Pseudo</label>
      <input
        type="text"
        id="pseudo"
        v-model="form.pseudo"
        placeholder="Ton pseudo"
        required
      />
    </div>

    <div>
      <label for="email">Email</label>
      <input
        type="email"
        id="email"
        v-model="form.email"
        required
      />
    </div>

    <div>
      <label for="password">Mot de passe</label>
      <input
        type="password"
        id="password"
        v-model="form.password"
        required
      />
    </div>

    <button type="submit">S’inscrire</button>
    <p v-if="error" style="color:red">{{ error }}</p>
  </form>
</template>

<script lang="ts">
import { ref } from 'vue';
import api from '../api';

export default {
  setup() {
    const form = ref({
      pseudo: '', // ⚠️ assure-toi qu’il est là !
      email: '',
      password: ''
    });

    const handleSubmit = async () => {
      try {
        const res = await api.post('/api/register', form.value);
        console.log(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    return { form, handleSubmit };
  }
};
</script>