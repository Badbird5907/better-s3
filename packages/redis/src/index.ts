import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

export const redis =
  globalThis.redis ??
  new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
}
