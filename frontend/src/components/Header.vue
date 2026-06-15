<template>
  <header>
    <div class="logo">CatFun</div>

    <nav>
      <a href="/accueil.html">Accueil</a>
      <a href="/pendu.html">Pendu</a>
      <a href="/memoire.html">Mémoire</a>
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

.game-card img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 12px;
}

</style>