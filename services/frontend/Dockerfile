FROM node:24-alpine AS deps

WORKDIR /app

COPY packages/site/package*.json ./
RUN npm install

FROM deps AS dev

COPY packages/site/ ./

EXPOSE 80

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]

FROM deps AS build

COPY packages/site/ ./
RUN npm run build

FROM node:24-alpine

RUN apk add --no-cache nginx

COPY services/frontend/nginx.conf /etc/nginx/http.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
