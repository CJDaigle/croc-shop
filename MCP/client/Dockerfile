FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY . .

EXPOSE 3010

CMD ["node", "server.js"]
