FROM ghcr.io/puppeteer/puppeteer:latest
USER root
WORKDIR /app

COPY package*.json ./
RUN rm -f package-lock.json && \
    npm install puppeteer@latest && \ 
    npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

USER pptruser

CMD ["npm", "start"]