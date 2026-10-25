FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node server ./server
COPY --chown=node:node src/gameEngine.ts src/gameConfig.ts src/protocol.ts ./src/
ENV NODE_ENV=production PORT=3001 DATA_FILE=/var/data/rooms.sqlite
RUN mkdir -p /var/data && chown node:node /var/data
USER node
EXPOSE 3001
CMD ["npm", "run", "server"]
