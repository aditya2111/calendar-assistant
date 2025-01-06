FROM ghcr.io/puppeteer/puppeteer:23.11.1

RUN apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/* \
    && which google-chrome

ENV PUPPETEER_SKIP_CHROME_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
COPY . .
CMD ["npm", "start", "--no-sandbox", "--disable-setuid-sandbox"]