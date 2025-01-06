FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Change working directory to app
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build TypeScript code
RUN npm run build

# Start command
CMD ["node", "./dist/app.js"]