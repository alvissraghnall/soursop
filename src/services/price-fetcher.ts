import { producer } from "../kafka";
import { cachePrice, getCachedPrice } from "../redis";
import fetch from "cross-fetch";
import { logger } from "../util/logger";

const PAIRS = ["solana-usd", "bonk-usd"];

let isFetching = false;

export async function fetchAllPrices() {
  if (isFetching) return;

  isFetching = true;
  try {
    const coins = PAIRS.map((p) => p.split("-")[0]);
    const vsCurrencies = [...new Set(PAIRS.map((p) => p.split("-")[1]))];

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(",")}&vs_currencies=${vsCurrencies.join(",")}`;
    const res = await fetch(url);
    const data = await res.json();

    for (const pair of PAIRS) {
      const [coin, vs] = pair.split("-");
      const price = data[coin]?.[vs];

      if (price) {
        await cachePrice(pair, price);

        await producer.send({
          topic: "price-updates",
          messages: [
            { value: JSON.stringify({ pair, price, timestamp: Date.now() }) },
          ],
        });
      }
    }

    logger.info({ pairs: PAIRS }, "Prices updated");
  } catch (error) {
    if (error instanceof Error) logger.error(error, "Price fetch failed");
  } finally {
    isFetching = false;
  }
}

export function startBackgroundFetcher() {
  fetchAllPrices();

  setInterval(fetchAllPrices, 19000);
  logger.info("Background price fetcher started");
}
