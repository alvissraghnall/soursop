import { createClient } from "redis";
import { logger } from "./util/logger";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = createClient({ url: redisUrl });

redis.on("error", (err) => logger.error(err, "Redis client error"));

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    logger.info("Redis connected");
  }
}

export async function cachePrice(pair: string, price: number, ttl = 60) {
  await redis.set(`price:${pair}`, price.toString(), {
    EX: ttl,
  });
}

export async function getCachedPrice(pair: string): Promise<number | null> {
  const price = await redis.get(`price:${pair}`);
  return price ? parseFloat(price) : null;
}
