# Étape 1 : build
FROM node:20 AS build

WORKDIR /app

# Copier package.json et package-lock.json et installer
COPY package*.json ./
RUN npm install

# Copier tout le code source
COPY . .

# Compiler le TypeScript dans ./dist
RUN npm run build

# Copier le bon index.html (celui à la racine) dans dist/
RUN cp index.html dist/

# Étape 2 : serveur de production
FROM node:20

WORKDIR /app

# Installer http-server globalement
RUN npm install -g http-server

# Copier le contenu de dist depuis l'étape build
COPY --from=build /app/dist ./dist

# Exposer le port
EXPOSE 8080

# Lancer le serveur sur le dossier dist
CMD ["http-server", "dist", "-p", "8080"]











