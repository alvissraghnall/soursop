import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = createClient({ url: redisUrl });

redis.connect().catch(console.error);

export async function cachePrice(pair: string, price: number, ttl = 60) {
  await redis.set(`price:${pair}`, price.toString(), {
    EX: ttl,
  });
}

export async function getCachedPrice(pair: string): Promise<number | null> {
  const price = await redis.get(`price:${pair}`);
  return price ? parseFloat(price) : null;
}
