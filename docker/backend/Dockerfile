FROM node:22-bookworm-slim

WORKDIR /app/server

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 \
     make \
     g++ \
     pkg-config \
     fish \
     libreoffice \
  && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server ./

EXPOSE 3001

CMD ["npm", "start"]
