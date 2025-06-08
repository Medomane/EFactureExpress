# 1) Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
# Use npm ci for more reliable builds
RUN npm ci

# Copy source & build
COPY . .
RUN npm run build

# 2) Serve stage
FROM nginx:alpine
# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
