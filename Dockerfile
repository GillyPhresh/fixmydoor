# Use Node.js 20 LTS Alpine for smaller image size
FROM node:20-alpine

# Install security updates and runtime libraries required by Prisma
RUN apk update && apk upgrade && apk add --no-cache dumb-init openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Prepare app and Railway SQLite volume directories. Railway volumes are mounted
# as root, so the runtime stays root to avoid SQLite write permission failures.
RUN mkdir -p /data && chown -R nextjs:nodejs /app /data

# Use the pnpm version pinned in package.json via Corepack.
RUN corepack enable

# Copy package files and patch files required by pnpm
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies. Railway builds need this because package.json changed
# after the lockfile was generated.
RUN pnpm install --no-frozen-lockfile --ignore-scripts

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
