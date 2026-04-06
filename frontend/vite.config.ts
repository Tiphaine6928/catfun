import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        accueil: resolve(__dirname, 'src/pages/accueil.html'),
        connexion: resolve(__dirname, 'src/pages/connexion.html'),
        inscription: resolve(__dirname, 'src/pages/inscription.html'),
        profil: resolve(__dirname, 'src/pages/profil.html'),
      }
    }
  }
})