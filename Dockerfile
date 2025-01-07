FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Debug: List Chrome locations
RUN echo "Checking Chrome installations:" && \
    which google-chrome || echo "google-chrome not found" && \
    which chromium || echo "chromium not found" && \
    which chromium-browser || echo "chromium-browser not found" && \
    ls -la /usr/bin/google-chrome* || echo "No google-chrome in /usr/bin" && \
    ls -la /usr/bin/chromium* || echo "No chromium in /usr/bin"

COPY package*.json ./
RUN rm -f package-lock.json && npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Check for Chrome path from puppeteer
RUN node -e "console.log('Puppeteer Chrome:', require('puppeteer').executablePath())"

USER pptruser

CMD npm start