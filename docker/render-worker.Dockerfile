FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY worker/render-worker.mjs ./worker/render-worker.mjs
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["node","worker/render-worker.mjs"]
