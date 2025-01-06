FROM ghcr.io/puppeteer/puppeteer:23.11.1

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

COPY package*.json ./


RUN npm install
COPY . .
RUN npm run build
WORKDIR /usr/src/app/dist

CMD ["node", "app.js"]