<template>
  <header>
    <nav>
      <a href="/accueil.html">Accueil</a> |
      <a href="/inscription.html">Inscription</a> |
      <a href="/connexion.html">Connexion</a> |
      <a href="/profil.html">Profil</a>
    </nav>
  </header>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'Header'
})
</script>

<style scoped>
nav a {
  margin-right: 15px;
  text-decoration: none;
  color: #333;
}
</style>