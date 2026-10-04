# ============================================================
# SENTINEL-X FRONTEND DOCKERFILE
# React + TypeScript + Vite
# ============================================================

# ------------------------------------------------------------
# Stage 1: Build
# ------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definition first for better Docker layer caching
COPY package.json ./

# Install dependencies
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy the frontend source
COPY . .

# Production build
RUN npm run build


# ------------------------------------------------------------
# Stage 2: Production runner
# ------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install lightweight static file server
RUN npm install -g serve@14

# Copy production build from builder
COPY --from=builder /app/dist ./dist

# Create a non-root user without an interactive password prompt
RUN addgroup -S -g 1001 frontend \
    && adduser -S -D -H -u 1001 -G frontend frontend \
    && chown -R frontend:frontend /app

# Run container as non-root user
USER frontend

# Frontend port
EXPOSE 5173

# Start Vite production build
CMD ["serve", "-s", "dist", "-l", "5173"]