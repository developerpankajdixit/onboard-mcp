# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (including dev) for the TypeScript build
COPY package*.json ./
RUN npm ci

# Compile src -> dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Only production deps in the final image
COPY package*.json ./
RUN npm ci --omit=dev

# Bring in the compiled server
COPY --from=builder /app/dist ./dist

# onboard-mcp is a stdio MCP server; Glama introspects it over stdio.
ENTRYPOINT ["node", "dist/index.js"]
