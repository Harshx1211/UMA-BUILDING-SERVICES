FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# ghostscript: post-processes the final merged report PDF to deduplicate
# font subsets independently embedded by each separately-rendered section
# (see src/pdf/optimizePdf.ts) — measured to cut a real report's size by
# more than half. optimizePdf.ts fails open if this is ever missing, so a
# broken install here degrades file size, not report generation itself.
RUN apt-get update && apt-get install -y --no-install-recommends ghostscript \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
