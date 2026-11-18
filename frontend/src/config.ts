/**
 * Adresse du backend Symfony.
 * Par défaut : nginx du docker-compose (http://localhost:8082).
 * Pour la changer, crée frontend/.env.local avec par exemple :
 *   VITE_API_URL=http://localhost:8000
 */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:8082').replace(/\/+$/, '');
