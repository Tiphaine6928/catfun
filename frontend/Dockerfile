# Étape 1 : build avec Vite
FROM node:22 AS build

WORKDIR /app

# Dépendances d'abord (meilleur cache des couches Docker)
COPY package.json package-lock.json ./
RUN npm ci

# Code source, puis build dans ./dist
COPY . .
RUN npm run build

# Étape 2 : serveur de fichiers statiques
FROM node:22

WORKDIR /app

RUN npm install -g http-server

COPY --from=build /app/dist ./dist

EXPOSE 8080

CMD ["http-server", "dist", "-p", "8080"]
