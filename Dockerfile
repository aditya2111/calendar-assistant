FROM ghcr.io/puppeteer/puppeteer:21.5.2

USER root
WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove package-lock.json and install dependencies
RUN rm -f package-lock.json && npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

USER pptruser

CMD ["npm", "start"]