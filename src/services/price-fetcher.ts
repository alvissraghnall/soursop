import { producer } from "../kafka";
import { cachePrice } from "../redis";
import fetch from "cross-fetch";

const PAIRS = ["sol-usd", "bonk-usd"];

export async function fetchAllPrices() {
  try {
    const coins = PAIRS.map((p) => p.split("-")[0]).join(",");
    const vsCurrencies = [...new Set(PAIRS.map((p) => p.split("-")[1]))].join(
      ",",
    );

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${vsCurrencies}`;
    const res = await fetch(url);
    const data = await res.json();

    // Cache each pair
    for (const pair of PAIRS) {
      const [coin, vs] = pair.split("-");
      const price = data[coin][vs];
      await cachePrice(pair, price);

      // Publish to Kafka
      await producer.send({
        topic: "price-updates",
        messages: [{ value: JSON.stringify({ pair, price }) }],
      });
    }
  } catch (error) {
    console.error("Background fetch error:", error);
  }
}

export function startBackgroundFetcher() {
  setInterval(fetchAllPrices, 2900);
  fetchAllPrices(); // Initial fetch
  console.log("Background price fetcher started");
}
