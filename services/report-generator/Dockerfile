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
# chromium: renders the report HTML to PDF (puppeteer-core drives it — see
#   src/render/chromium.ts). Replaces the separate Gotenberg service.
# fonts-*: the CSS asks for Helvetica/Arial; Liberation Sans is the
#   metric-compatible substitute fontconfig picks for both (same family
#   Gotenberg's image resolved to), DejaVu covers extra glyphs, Noto Color
#   Emoji covers emoji typed into notes.
# ghostscript: shrinks the final PDF (src/pdf/optimizePdf.ts fails open if
#   it's ever missing).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation fonts-liberation2 fonts-dejavu-core fonts-noto-color-emoji \
      ghostscript ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium
# Report dates/times are formatted with the server's local time zone
# (templates/helpers.ts passes no timeZone). Without this they printed in UTC,
# 10-11h behind NSW — a 9am inspection showed as 10pm the previous day. Same
# convention as the admin portal (admin/src/lib/utils.ts).
ENV TZ=Australia/Sydney
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
