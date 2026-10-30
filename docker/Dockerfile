FROM node:24.22.2-bookworm-slim AS api
ENV NODE_ENV=development
WORKDIR /workspace/Backend
COPY Backend/package.json Backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
RUN chown -R node:node /workspace/Backend/node_modules
COPY Backend/ ./
COPY shared/ /workspace/shared/
USER node
EXPOSE 3000
CMD ["npm", "run", "dev:server"]

FROM node:24.22.2-bookworm-slim AS web
ENV NODE_ENV=development
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY shared/ shared/
COPY Frontend/package.json Frontend/package-lock.json Frontend/
RUN npm ci --prefix Frontend --no-audit --no-fund
RUN chown -R node:node /workspace/Frontend/node_modules
COPY Frontend/ Frontend/
WORKDIR /workspace/Frontend
USER node
EXPOSE 3001
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3001", "--strictPort"]

FROM node:24.22.2-bookworm-slim AS mobile
ENV NODE_ENV=development
WORKDIR /workspace/sondar-mobile
COPY sondar-mobile/package.json sondar-mobile/package-lock.json ./
RUN npm ci --no-audit --no-fund
RUN node -e "const fs=require('fs'),c=require('crypto');fs.writeFileSync('node_modules/.sondar-lock-hash',c.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex'))"
COPY sondar-mobile/ ./
COPY shared/ /workspace/shared/
COPY scripts/docker-start-mobile.cjs /workspace/docker-start-mobile.cjs
RUN chown -R node:node /workspace/sondar-mobile/node_modules
USER node
EXPOSE 8081
CMD ["node", "/workspace/docker-start-mobile.cjs"]
