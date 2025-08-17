import { getCachedPrice } from "../redis";

export async function getPrice(pair: string): Promise<number> {
  const price = await getCachedPrice(pair);
  if (!price) throw new Error("Price not available yet");
  return price;
}
