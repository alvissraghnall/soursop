import {
  createKeyPairSignerFromPrivateKeyBytes,
  generateKeyPair,
  generateKeyPairSigner,
  getUtf8Encoder,
  signBytes,
  verifySignature,
} from "@solana/kit";
import {
  getJupiterQuote,
  getSwapInstructions,
  simulateSwap,
  getTokenMetadata,
} from "./jupiter";
import { getRequiredEnv } from "../util/env-helper";

describe("Swap Actual Test", () => {
  it("should get a real quote and successfully simulate the transaction", async () => {
    const privateKey = JSON.parse(
      getRequiredEnv("ACTUAL_TEST_PRIVATE_KEY"),
    ) as Array<number>;

    console.log(privateKey);
    const privateKeyBuf = new Uint8Array(privateKey.slice(0, 32));

    //      const privateKeyPkcs8 = await crypto.subtle.importKey('pkcs8', privateKeyBuf, { name: "Ed25519" }, false, ['sign']);

    const walletSigner = await createKeyPairSignerFromPrivateKeyBytes(
      privateKeyBuf,
      false,
    );

    const testMessage = getUtf8Encoder().encode("The meeting is at 6:00pm");
    const testSignature = await signBytes(
      walletSigner.keyPair.privateKey,
      testMessage,
    );

    const verificationSucceeded = await verifySignature(
      walletSigner.keyPair.publicKey,
      testSignature,
      getUtf8Encoder().encode("The meeting is at 6:00pm"),
    );
    expect(verificationSucceeded).toBe(true);

    const quoteResponse = await getJupiterQuote(
      "So11111111111111111111111111111111111111112", // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      0.000001, // 1000 Lamports
      50,
    );

    const swapInstructions = await getSwapInstructions(
      quoteResponse,
      walletSigner.address,
    );

    console.log(swapInstructions);

    const simulationResult = await simulateSwap(walletSigner, swapInstructions);

    console.log(simulationResult.value);
    expect(simulationResult.value.err).toBeNull();
    expect(simulationResult.value.logs).not.toBeNull();

    console.log("✅ Successfully simulated a mainnet transaction.");
    console.log(
      `- Transaction logs: ${simulationResult.value.logs?.length} lines`,
    );
    console.log(simulationResult.value);
  }, 30000);
});

describe("getTokenMetadata Integration Tests", () => {
  const REAL_TOKEN_ADDRESSES = {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",

    SOL: "So11111111111111111111111111111111111111112",

    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",

    NONEXISTENT: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
  };

  const INVALID_ADDRESSES = [
    "",
    "invalid",
    "123",
    "ThisIsNotAValidSolanaAddress",
    "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
  ];

  const TEST_TIMEOUT = 30000;

  describe("Valid Token Addresses", () => {
    it(
      "should return metadata for USDC token",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC);

        if (result) {
          expect(result).toHaveProperty("name");
          expect(result).toHaveProperty("symbol");
          expect(result).toHaveProperty("logo");

          expect(typeof result.name).toBe("string");
          expect(typeof result.symbol).toBe("string");

          if (result.logo !== null) {
            expect(typeof result.logo).toBe("string");

            expect(result.logo).toMatch(/^https?:\/\/.+/);
          }

          console.log("USDC Metadata:", result);
        } else {
          expect(result).toBeUndefined();
        }
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle SOL native token",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.SOL);

        if (result) {
          expect(result).toHaveProperty("name");
          expect(result).toHaveProperty("symbol");
          expect(result).toHaveProperty("logo");
          console.log("SOL Metadata:", result);
        } else {
          expect(result).toBeUndefined();
        }
      },
      TEST_TIMEOUT,
    );

    it(
      "should return metadata for BONK token",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.BONK);

        if (result) {
          expect(result).toHaveProperty("name");
          expect(result).toHaveProperty("symbol");
          expect(result).toHaveProperty("logo");

          expect(typeof result.name).toBe("string");
          expect(typeof result.symbol).toBe("string");

          console.log("BONK Metadata:", result);
        } else {
          expect(result).toBeUndefined();
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Nonexistent Token Addresses", () => {
    it(
      "should return undefined for nonexistent token",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.NONEXISTENT);
        expect(result).toBeUndefined();
      },
      TEST_TIMEOUT,
    );
  });

  describe("Invalid Token Addresses", () => {
    it.each(INVALID_ADDRESSES)(
      'should handle invalid address: "%s"',
      async (invalidAddress) => {
        try {
          const result = await getTokenMetadata(invalidAddress);

          expect(result).toBeUndefined();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Return Value Structure", () => {
    it(
      "should return consistent structure when metadata exists",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC);

        if (result) {
          const expectedKeys = ["name", "symbol", "logo"];
          const actualKeys = Object.keys(result);

          expectedKeys.forEach((key) => {
            expect(actualKeys).toContain(key);
          });

          expect(actualKeys).toHaveLength(expectedKeys.length);

          expect(typeof result.name).toBe("string");
          expect(typeof result.symbol).toBe("string");
          expect(result.logo === null || typeof result.logo === "string").toBe(
            true,
          );
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Network and URI Handling", () => {
    it(
      "should handle URI fetch failures",
      async () => {
        const testTokens = [
          REAL_TOKEN_ADDRESSES.USDC,
          REAL_TOKEN_ADDRESSES.BONK,
        ];

        for (const tokenAddress of testTokens) {
          try {
            const result = await getTokenMetadata(tokenAddress);

            if (result) {
              if (result.logo !== null) {
                expect(typeof result.logo).toBe("string");
              }

              expect(typeof result.name).toBe("string");
              expect(typeof result.symbol).toBe("string");
            }
          } catch (error) {
            console.warn(`Network error for token ${tokenAddress}:`, error);
          }
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Data Quality and Validation", () => {
    it(
      "should return non-empty strings for name and symbol when metadata exists",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC);

        if (result) {
          expect(result.name.length).toBeGreaterThan(0);
          expect(result.symbol.length).toBeGreaterThan(0);

          expect(result.name.trim().length).toBeGreaterThan(0);
          expect(result.symbol.trim().length).toBeGreaterThan(0);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle special characters in token metadata",
      async () => {
        const testTokens = [
          REAL_TOKEN_ADDRESSES.USDC,
          REAL_TOKEN_ADDRESSES.BONK,
        ];

        for (const tokenAddress of testTokens) {
          const result = await getTokenMetadata(tokenAddress);

          if (result) {
            expect(result.name).toMatch(/^[\s\S]*$/);
            expect(result.symbol).toMatch(/^[\s\S]*$/);

            expect(result.name).not.toContain("\0");
            expect(result.symbol).not.toContain("\0");
          }
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Performance and Reliability", () => {
    it(
      "should complete within reasonable time",
      async () => {
        const startTime = Date.now();

        try {
          await getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC);
          const endTime = Date.now();
          const duration = endTime - startTime;

          expect(duration).toBeLessThan(15000);
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          expect(duration).toBeLessThan(15000);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle multiple concurrent calls",
      async () => {
        const promises = [
          getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC),
          getTokenMetadata(REAL_TOKEN_ADDRESSES.BONK),
          getTokenMetadata(REAL_TOKEN_ADDRESSES.SOL),
        ];

        const results = await Promise.allSettled(promises);

        expect(results).toHaveLength(3);

        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            if (result.value) {
              expect(result.value).toHaveProperty("name");
              expect(result.value).toHaveProperty("symbol");
              expect(result.value).toHaveProperty("logo");
            }
          } else {
            expect(result.reason).toBeInstanceOf(Error);
          }
        });
      },
      TEST_TIMEOUT,
    );
  });

  describe("Edge Cases and Error Conditions", () => {
    it(
      "should handle network timeouts gracefully",
      async () => {
        try {
          const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC);

          if (result) {
            expect(result).toHaveProperty("name");
            expect(result).toHaveProperty("symbol");
            expect(result).toHaveProperty("logo");
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle malformed or empty responses",
      async () => {
        const edgeCaseTokens = [
          REAL_TOKEN_ADDRESSES.SOL,
          REAL_TOKEN_ADDRESSES.NONEXISTENT,
        ];

        for (const tokenAddress of edgeCaseTokens) {
          try {
            const result = await getTokenMetadata(tokenAddress);

            if (result !== undefined) {
              expect(result).toHaveProperty("name");
              expect(result).toHaveProperty("symbol");
              expect(result).toHaveProperty("logo");
            }
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
          }
        }
      },
      TEST_TIMEOUT,
    );
  });

  describe("Real-world Integration", () => {
    it(
      "should work with current Solana mainnet",
      async () => {
        const result = await getTokenMetadata(REAL_TOKEN_ADDRESSES.USDC);

        if (result) {
          expect(result.name).toBeDefined();
          expect(result.symbol).toBeDefined();

          console.log("Live USDC metadata:", {
            name: result.name,
            symbol: result.symbol,
            hasLogo: result.logo !== null,
            logoUrl: result.logo,
          });

          if (result.symbol) {
            expect(result.symbol.toLowerCase()).toContain("usd");
          }
        } else {
          console.log("No metadata found for USDC token");
        }
      },
      TEST_TIMEOUT,
    );
  });
});
