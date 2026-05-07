# Use Node.js 20 LTS Alpine for smaller image size
FROM node:20-alpine

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Prepare app and Railway SQLite volume directories
RUN mkdir -p /data && chown -R nextjs:nodejs /app /data
USER nextjs

# Install pnpm
RUN npm install -g pnpm

# Copy package files and patch files required by pnpm
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["pnpm", "start"]
