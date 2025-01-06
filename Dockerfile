FROM ghcr.io/puppeteer/puppeteer:23.11.1

RUN apt-get update \
    && apt-get install -y chromium-browser \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
COPY . .
CMD ["npm", "start"]