<template>
  <Header />

  <div class="container">
    <h1>Jeu du Pendu</h1>

    <p class="word">
      <span v-for="(letter, index) in hiddenWord" :key="index">
        {{ letter }}
      </span>
    </p>

    <p>Essais restants : {{ attempts }}</p>

    <input
      v-model="inputLetter"
      maxlength="1"
      placeholder="Lettre"
    />

    <button class="btn" @click="guessLetter">
      Tester
    </button>

    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script lang="ts">
import { ref, computed } from 'vue';
import Header from './Header.vue';

export default {
  components: { Header },
  setup() {
    const word = ref('CHAT');
    const guessedLetters = ref<string[]>([]);
    const attempts = ref(6);
    const inputLetter = ref('');
    const message = ref('');

    const hiddenWord = computed(() =>
      word.value.split('').map(letter =>
        guessedLetters.value.includes(letter) ? letter : '_'
      )
    );

    const guessLetter = () => {
      const letter = inputLetter.value.toUpperCase();

      if (!letter) return;

      if (!word.value.includes(letter)) {
        attempts.value--;
      } else {
        guessedLetters.value.push(letter);
      }

      inputLetter.value = '';

      if (attempts.value <= 0) {
        message.value = 'Perdu 😢';
      }

      if (!hiddenWord.value.includes('_')) {
        message.value = 'Gagné 🎉';
      }
    };

    return {
      hiddenWord,
      attempts,
      inputLetter,
      guessLetter,
      message
    };
  }
};
</script>

<style scoped>
.word {
  font-size: 30px;
  letter-spacing: 10px;
  margin: 20px 0;
}
</style>