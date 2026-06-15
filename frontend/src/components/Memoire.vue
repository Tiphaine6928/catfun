<template>
  <Header />

  <div class="container">
    <h1>Jeu de Mémoire</h1>

    <div class="grid">
      <div
        v-for="(card, index) in cards"
        :key="index"
        class="card"
        @click="flipCard(index)"
      >
        <span v-if="card.flipped || card.matched">
          {{ card.value }}
        </span>
        <span v-else>
          ❓
        </span>
      </div>
    </div>

    <p v-if="message" class="message">
      {{ message }}
    </p>

    <button class="btn" @click="restartGame">
      Rejouer
    </button>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue';
import Header from './Header.vue';

interface Card {
  value: string;
  flipped: boolean;
  matched: boolean;
}

export default {
  components: {
    Header
  },

  setup() {
    const emojis = ['🐱', '🐶', '🐭', '🐹'];

    const createCards = (): Card[] => {
      return [...emojis, ...emojis]
        .sort(() => Math.random() - 0.5)
        .map((emoji) => ({
          value: emoji,
          flipped: false,
          matched: false
        }));
    };

    const cards = ref<Card[]>(createCards());

    const firstCard = ref<number | null>(null);
    const secondCard = ref<number | null>(null);

    const message = ref('');

    const flipCard = (index: number) => {
      const card = cards.value[index];

      if (
        card.flipped ||
        card.matched ||
        secondCard.value !== null
      ) {
        return;
      }

      card.flipped = true;

      if (firstCard.value === null) {
        firstCard.value = index;
        return;
      }

      secondCard.value = index;

      const card1 = cards.value[firstCard.value];
      const card2 = cards.value[secondCard.value];

      if (card1.value === card2.value) {
        card1.matched = true;
        card2.matched = true;

        firstCard.value = null;
        secondCard.value = null;

        checkVictory();
      } else {
        setTimeout(() => {
          card1.flipped = false;
          card2.flipped = false;

          firstCard.value = null;
          secondCard.value = null;
        }, 1000);
      }
    };

    const checkVictory = () => {
      const won = cards.value.every(card => card.matched);

      if (won) {
        message.value = '🎉 Bravo ! Vous avez gagné !';
      }
    };

    const restartGame = () => {
      cards.value = createCards();
      firstCard.value = null;
      secondCard.value = null;
      message.value = '';
    };

    return {
      cards,
      flipCard,
      restartGame,
      message
    };
  }
};
</script>

<style scoped>
.container {
  text-align: center;
  margin-top: 50px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 100px);
  gap: 15px;
  justify-content: center;
  margin: 30px 0;
}

.card {
  width: 100px;
  height: 100px;
  background-color: #8b5cf6;
  color: white;
  font-size: 40px;
  border-radius: 15px;

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;

  transition: transform 0.2s;
}

.card:hover {
  transform: scale(1.05);
}

.message {
  font-size: 20px;
  font-weight: bold;
  color: green;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 20px;
  background: #8b5cf6;
  color: white;
  cursor: pointer;
}
</style>