import { producer } from "../kafka";
import { cachePrice, getCachedPrice } from "../redis";
import axios from "axios";

const PAIRS = ["solana-usd", "bonk-usd"];

let isFetching = false;

export async function fetchAllPrices() {
  if (isFetching) return;

  isFetching = true;
  try {
    const coins = PAIRS.map((p) => p.split("-")[0]);
    const vsCurrencies = [...new Set(PAIRS.map((p) => p.split("-")[1]))];

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(",")}&vs_currencies=${vsCurrencies.join(",")}`;
    const res = await axios.get(url, { timeout: 5000 });

    for (const pair of PAIRS) {
      const [coin, vs] = pair.split("-");
      const price = res.data[coin]?.[vs];

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

    console.log(`✅ Prices updated at ${new Date().toISOString()}`);
  } catch (error) {
    if (error instanceof Error)
      console.error("❌ Price fetch failed:", error.message);
  } finally {
    isFetching = false;
  }
}

export function startBackgroundFetcher() {
  fetchAllPrices();

  setInterval(fetchAllPrices, 19000);
  console.log("🔄 Background price fetcher started");
}
