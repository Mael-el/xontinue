# ============================================================
# DOCKERFILE — AfricaSkills (Next.js standalone, production)
#
# Build :  docker build -t africaskills .
# Run   :  docker run -p 3000:3000 --env-file .env africaskills
#
# Le build n'exige aucune base joignable (DATABASE_URL factice).
# Les vraies variables sont injectées AU RUNTIME (-e / --env-file).
# ============================================================

# ---- Étape 1 : dépendances ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- Étape 2 : build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL factice : aucun appel DB n'est fait au build (pages dynamiques)
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL=postgresql://dummy:dummy@127.0.0.1:1/dummy \
    JWT_SECRET=build-time-placeholder-not-used-at-runtime-32c \
    JWT_REFRESH_SECRET=build-time-placeholder-not-used-at-runtime-32c
RUN npm run build

# ---- Étape 3 : image finale ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Utilisateur non-root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Sortie standalone (server.js + node_modules minimal)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Dossier d'upload local (avatars) — monter un volume ici si besoin
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
