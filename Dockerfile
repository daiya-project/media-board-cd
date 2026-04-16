# syntax=docker/dockerfile:1.6
# 2-stage build for Next.js 16 app (standalone output) on LiteLLM Code Deploy.
# Runs as non-root (uid 1000). allowPrivilegeEscalation=false — no runtime chown.
#
# 이전 3-stage 구조(deps + builder + runner)에서 deps/builder 사이 Kaniko snapshot
# 단계가 일관되게 빌드를 fail 시켜 단순화. install + build 를 builder 한 단계에서 처리.

############################
# Stage 1: builder (install + build)
############################
FROM node:20-slim AS builder
WORKDIR /app
ENV HOME=/app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* must be present at build time — Next.js inlines these into the client bundle.
# Public by design (Supabase anon key is safe for browsers).
ENV NEXT_PUBLIC_SUPABASE_URL=https://lmftwznuhgphousfojpb.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZnR3em51aGdwaG91c2ZvanBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTgyNTUsImV4cCI6MjA4MzEzNDI1NX0.ddjVeN3cL2B5kvE6mLNWS1hen8OBOoETPEIhioFxELk
ENV NEXT_PUBLIC_IMPORT_CVR_CSV_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1vT5wr5hm8BSyVvXXXFl237JbwVj6jglSWIaXLzrhqeONmpRlUoHuVchtiPHlCcrLNYgyiixq2VRh7Tv/pub?gid=2116998053&single=true&output=csv

COPY package.json package-lock.json ./
# `npm ci` 가 macOS 에서 생성된 lock 의 platform-specific dep 부재로
# linux Kaniko 빌드에서 무결성 실패 → `npm install` 로 platform-aware install.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

############################
# Stage 2: runner
############################
FROM node:20-slim AS runner
WORKDIR /app
ENV HOME=/app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Keep NEXT_PUBLIC_* available at runtime too (SSR routes read them server-side).
ENV NEXT_PUBLIC_SUPABASE_URL=https://lmftwznuhgphousfojpb.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZnR3em51aGdwaG91c2ZvanBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTgyNTUsImV4cCI6MjA4MzEzNDI1NX0.ddjVeN3cL2B5kvE6mLNWS1hen8OBOoETPEIhioFxELk
ENV NEXT_PUBLIC_IMPORT_CVR_CSV_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1vT5wr5hm8BSyVvXXXFl237JbwVj6jglSWIaXLzrhqeONmpRlUoHuVchtiPHlCcrLNYgyiixq2VRh7Tv/pub?gid=2116998053&single=true&output=csv

# Copy standalone output with correct ownership baked in at copy time (non-root can't chown at runtime).
COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static

USER 1000
EXPOSE 3000
CMD ["node", "server.js"]
