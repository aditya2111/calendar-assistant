FROM node:slim

# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

WORKDIR /app

# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*


# Copy package.json and package-lock.json first for better caching
COPY package*.json ./


# Build TypeScript files
RUN npm run build

# Copy the entire project to the working directory
COPY . .

# Ensure proper permissions for the Chrome executable
RUN chmod -R o+rx /usr/bin/google-chrome-stable


# Set the command to run the application
CMD ["npm", "start", "dist/app.js"]