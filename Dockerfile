FROM node:20-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Copy source code and TypeScript config
COPY . .

# Install dependencies and build
RUN npm install && \
    npm run build

# Expose the port the app runs on
EXPOSE 3002

# Set environment variable for Miro OAuth token
ENV MIRO_OAUTH_TOKEN=""

# Command to run the application
CMD ["node", "build/index.js"]