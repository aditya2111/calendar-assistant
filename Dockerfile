FROM node:18-slim

# Set the working directory
WORKDIR /usr/src/app

# Install necessary dependencies and Google Chrome Stable
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libgbm-dev \
    libnspr4 \
    libnss3 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Add Google Chrome's official signing key and repository
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-chrome.gpg && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable

# Prevent Puppeteer from downloading Chromium separately
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package files and install project dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the entire project into the container
COPY . .

# Build the project (if using TypeScript)
RUN npm run build

# Start the application
CMD ["npm", "start"]