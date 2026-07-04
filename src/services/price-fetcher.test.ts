import fetch from "cross-fetch";
import { producer } from "../kafka";
import { cachePrice } from "../redis";
import * as priceFetcher from "./price-fetcher";

jest.mock("cross-fetch", () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});
jest.mock("../kafka", () => ({
  producer: {
    send: jest.fn(),
  },
}));
jest.mock("../redis", () => ({
  cachePrice: jest.fn(),
}));
jest.mock("../util/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("fetchAllPrices", () => {
  const mockResponse = {
    sol: { usd: 23.45 },
    bonk: { usd: 0.00000123 },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (fetch as jest.Mock).mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse),
    });
  });

  it("should fetch prices, cache them, and send to Kafka", async () => {
    await priceFetcher.fetchAllPrices();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("coingecko.com"),
    );

    expect(cachePrice).toHaveBeenCalledWith("sol-usd", 23.45);
    expect(cachePrice).toHaveBeenCalledWith("bonk-usd", 0.00000123);

    expect(producer.send).toHaveBeenCalledWith({
      topic: "price-updates",
      messages: [{ value: JSON.stringify({ pair: "sol-usd", price: 23.45 }) }],
    });
    expect(producer.send).toHaveBeenCalledWith({
      topic: "price-updates",
      messages: [
        { value: JSON.stringify({ pair: "bonk-usd", price: 0.00000123 }) },
      ],
    });
  });

  it("should handle missing price data gracefully", async () => {
    const badData = { sol: {} };
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValue(badData),
    });

    await priceFetcher.fetchAllPrices();

    expect(cachePrice).toHaveBeenCalledWith("sol-usd", undefined);
    expect(producer.send).toHaveBeenCalledWith({
      topic: "price-updates",
      messages: [
        { value: JSON.stringify({ pair: "sol-usd", price: undefined }) },
      ],
    });
  });

  it("should log errors if fetch fails", async () => {
    const { logger } = require("../util/logger");
    (fetch as jest.Mock).mockRejectedValue(new Error("API down"));

    await priceFetcher.fetchAllPrices();

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      "Price fetch failed",
    );
  });
});

describe("startBackgroundFetcher", () => {
  it("should start the background fetcher", () => {
    jest.useFakeTimers();
    const { logger } = require("../util/logger");

    priceFetcher.startBackgroundFetcher();

    expect(logger.info).toHaveBeenCalledWith(
      "Background price fetcher started",
    );
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 19000);

    jest.useRealTimers();
  });
});
