# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile=false

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Railway Variables with the same names are passed as build-args.
# NEXT_PUBLIC_* must be present at `next build` time (baked into the client bundle).
ARG NEXT_PUBLIC_BFF_URL
ARG NEXT_PUBLIC_MODE=PROD
ARG NEXT_PUBLIC_FILE_HOST=https://static.four.meme
ARG NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID=1778027615733

ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV NEXT_PUBLIC_MODE=$NEXT_PUBLIC_MODE
ENV NEXT_PUBLIC_FILE_HOST=$NEXT_PUBLIC_FILE_HOST
ENV NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID=$NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID

RUN if [ -z "$NEXT_PUBLIC_BFF_URL" ]; then \
		echo "ERROR: NEXT_PUBLIC_BFF_URL is required at Docker build time" >&2; \
		exit 1; \
	fi \
	&& pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
