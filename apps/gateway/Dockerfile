# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies. We use `npm install` instead of `npm ci`
# because the workspace intentionally does not track a package-lock.json.
# This keeps the Docker build aligned with the local setup.
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build the application
RUN npx tsc -p tsconfig.docker.json

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 8443

# Start the application
CMD ["npm", "start"]
