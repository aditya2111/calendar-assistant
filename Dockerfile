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
# Update this to match the actual path from the puppeteer Docker image
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

USER pptruser

# Add a check before starting the app
CMD /usr/bin/google-chrome-stable --version && \
    ls -l /usr/bin/google-chrome-stable && \
    npm start