<template>
  <header>
    <div class="logo">CatFun</div>

    <nav>
      <a href="/accueil.html">Accueil</a>
      <a href="#">Pendu</a>
      <a href="#">Mémoire</a>
    </nav>

    <button class="btn" @click="goAuth">
      Inscription / Connexion
    </button>
  </header>
</template>

<script lang="ts">
export default {
  methods: {
    goAuth() {
      window.location.href = '/connexion.html';
    }
  }
};
</script>

<style scoped>
.logo {
  font-weight: bold;
  font-size: 20px;
}
</style>