import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        accueil: resolve(__dirname, 'src/pages/accueil.html'),
        jeu1: resolve(__dirname, 'src/pages/jeu1.html'),
        jeu2: resolve(__dirname, 'src/pages/jeu2.html'),
        inscription: resolve(__dirname, 'src/pages/inscription.html'),
        connexion: resolve(__dirname, 'src/pages/connexion.html'),
        profil: resolve(__dirname, 'src/pages/profil.html'),
      }
    }
  }
})