# Use Node.js Slim (Debian-based) for better compatibility
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install OpenSSL (required for Prisma)
RUN apt-get update -y && apt-get install -y openssl

# Install dependencies

# Install dependencies (only production to keep image small)
# Note: We need dev dependencies for Prisma generation in some cases, 
# but usually 'npm ci' is preferred for builds. 
# For simplicity/safety with mixed deps, we'll use npm install here.
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 4000

# Start the server
CMD ["npm", "start"]
