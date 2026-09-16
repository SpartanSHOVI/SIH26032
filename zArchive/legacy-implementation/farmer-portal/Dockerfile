# Build stage
FROM node:22.23.2-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY farmer-portal/package.json farmer-portal/pnpm-lock.yaml* farmer-portal/

WORKDIR /app/farmer-portal
RUN pnpm install --no-frozen-lockfile --prod=false

COPY farmer-portal/ .
RUN pnpm run build

# Runtime stage (nginx for static files)
FROM nginx:alpine

COPY --from=builder /app/farmer-portal/dist /usr/share/nginx/html
COPY farmer-portal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]