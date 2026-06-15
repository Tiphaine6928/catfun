<template>
  <Header />

  <main class="home">

    <img src="/images/logo_catfun.png" alt="CatFun" class="logo-home"/>

    <h1>Bienvenue sur CatFun !</h1>

    <p>
      Découvrez nos mini-jeux amusants sur le thème des chats.
    </p>

    <div class="games">

      <!-- Carte Pendu -->
      <div class="game-card">
        <img src="/images/chat_pendu.png" alt="Pendu" />

        <h2>Jeu du Pendu</h2>

        <p>
          Devinez les mots liés aux chats avant que le dessin ne soit terminé !
        </p>

        <button
          class="btn"
          @click="goToPendu"
        >
          Jouer au Pendu
        </button>
      </div>

      <!-- Carte Mémoire -->
      <div class="game-card">
        <img src="/images/chat_jeu_memoire.png" alt="Mémoire" />

        <h2>Jeu de Mémoire</h2>

        <p>
          Retrouvez les paires de cartes avec des images de chats adorables !
        </p>

        <button
          class="btn"
          @click="goToMemoire"
        >
          Jouer au Mémoire
        </button>
      </div>

    </div>

  </main>
</template>

<style scoped>
.home {
  text-align: center;
  padding: 20px;
  min-height: 100vh;
  background: linear-gradient(180deg, #fff6fb 0%, #fff 60%, #fff3ec 100%);
}

/* LOGO PRINCIPAL */
.logo-home {
  width: 140px;
  margin: 20px auto;
  display: block;
  border-radius: 50%;
}

/* TITRE */
h1 {
  color: #7c2ae8;
  font-size: 2.2rem;
  margin-bottom: 10px;
}

/* DESCRIPTION */
.home p {
  color: #555;
  max-width: 600px;
  margin: 0 auto;
}

/* CONTAINER DES CARTES */
.games {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 40px;
  flex-wrap: wrap;
  margin-top: 60px;
}

/* CARTES */
.game-card {
  width: 300px;
  background: white;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.game-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
}

/* IMAGES DES CARTES */
.game-card img {
  width: 120px;
  height: auto;
  margin-bottom: 10px;
}

/* TITRES DES CARTES */
.game-card h2 {
  color: #7c2ae8;
  font-size: 1.3rem;
}

/* TEXTE */
.game-card p {
  font-size: 0.9rem;
  color: #666;
}

/* BOUTON */
.btn {
  margin-top: 15px;
  padding: 10px 18px;
  border: none;
  border-radius: 25px;
  background: #8b3dff;
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s ease;
}

.btn:hover {
  background: #6f2bd6;
}

</style>

<script lang="ts">
import Header from './Header.vue';

export default {
  components: {
    Header
  },

  methods: {
    goToPendu() {
      window.location.href = '/pendu.html';
    },

    goToMemoire() {
      window.location.href = '/memoire.html';
    }
  }
};
</script>