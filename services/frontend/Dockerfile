FROM node:24-alpine AS build

WORKDIR /app

COPY packages/site/package*.json ./
RUN npm install

COPY packages/site/ ./
RUN npm run build

FROM node:24-alpine

RUN apk add --no-cache nginx

COPY services/frontend/nginx.conf /etc/nginx/http.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
