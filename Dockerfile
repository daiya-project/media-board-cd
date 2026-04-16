# syntax=docker/dockerfile:1.6
# Multi-stage build for Next.js 16 app (standalone output) on LiteLLM Code Deploy.
# Runs as non-root (uid 1000). allowPrivilegeEscalation=false — no runtime chown.

############################
# Stage 1: dependencies
############################
FROM node:20-slim AS deps
WORKDIR /app
ENV HOME=/app
COPY package.json package-lock.json ./
RUN npm ci

############################
# Stage 2: builder
############################
FROM node:20-slim AS builder
WORKDIR /app
ENV HOME=/app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* must be present at build time — Next.js inlines these into the client bundle.
# These values are public by design (Supabase anon key is safe for browsers; CSV URLs are
# Google Sheets published links). Real server secrets (KLMEDIA_API_KEY) stay in LiteLLM credentials.
ENV NEXT_PUBLIC_SUPABASE_URL=https://lmftwznuhgphousfojpb.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZnR3em51aGdwaG91c2ZvanBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTgyNTUsImV4cCI6MjA4MzEzNDI1NX0.ddjVeN3cL2B5kvE6mLNWS1hen8OBOoETPEIhioFxELk
ENV NEXT_PUBLIC_IMPORT_CVR_CSV_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1vT5wr5hm8BSyVvXXXFl237JbwVj6jglSWIaXLzrhqeONmpRlUoHuVchtiPHlCcrLNYgyiixq2VRh7Tv/pub?gid=2116998053&single=true&output=csv
ENV NEXT_PUBLIC_IMPORT_CSV_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1vT5wr5hm8BSyVvXXXFl237JbwVj6jglSWIaXLzrhqeONmpRlUoHuVchtiPHlCcrLNYgyiixq2VRh7Tv/pub?gid=1136837658&single=true&output=csv

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

############################
# Stage 3: runner
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
ENV NEXT_PUBLIC_IMPORT_CSV_URL=https://docs.google.com/spreadsheets/d/e/2PACX-1vT5wr5hm8BSyVvXXXFl237JbwVj6jglSWIaXLzrhqeONmpRlUoHuVchtiPHlCcrLNYgyiixq2VRh7Tv/pub?gid=1136837658&single=true&output=csv

# Copy standalone output with correct ownership baked in at copy time (non-root can't chown at runtime).
COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static

USER 1000
EXPOSE 3000
CMD ["node", "server.js"]
