# Use supported Node.js version
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files
COPY package*.json ./
# Delete existing node_modules and package-lock.json first


# Install build dependencies first
RUN apk add --no-cache --update python3 make g++

# Configure npm to retry more times and with longer timeouts
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5

# Split the installations into smaller chunks to reduce likelihood of timeout
RUN npm install --legacy-peer-deps || npm install --legacy-peer-deps


# Copy the rest of the application code
COPY . .

# Fix the issues in the code files
RUN sed -i 's/clientId:/clientID:/' src/auth/strategies/google.strategy.ts && \
    sed -i 's/callBackURL/callbackURL/' src/auth/strategies/google.strategy.ts && \
    sed -i 's/import \* as connectRedis from/import connectRedis from/' src/main.ts && \
    sed -i 's/private readonly paystack: Paystack/private readonly paystack: any/' src/payment/payment.service.ts

# Build the application
RUN npm run build

# Add after build step
RUN npm run migration:run
# Instead of: RUN npm run typeorm migration:run

# Expose the application port
EXPOSE 3000

ENV NODE_ENV=production
ENV REDIS_HOST=redis
ENV DEBUG=ioredis:*

# Update path to match NestJS structure
CMD ["node", "dist/main"]