# Use Node.js LTS (Long Term Support)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install system dependencies (OpenSSL is required for Prisma on Alpine)
RUN apk -U upgrade && apk add --no-cache openssl

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
