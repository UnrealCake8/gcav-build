FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY src/city-life.js src/salik.js src/world-layout.js src/outfits.js src/road-network.js ./src/
COPY src/data/dubai-buildings.json src/data/dubai-roads.json src/data/dubai-landmarks.json src/data/dubai-gates.json ./src/data/

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3001
CMD ["npm", "start"]
