FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /data/media && chown -R node:node /data
ENV NODE_ENV=production PORT=4173 DB_PATH=/data/manji.db MEDIA_ROOT=/data/media
USER node
EXPOSE 4173
CMD ["node", "server/index.js"]
