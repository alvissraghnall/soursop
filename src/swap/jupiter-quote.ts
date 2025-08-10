class JupiterQuote {
  constructor(private quoteResponse: QuoteResponse) {}

  get inputAmount(): bigint {
    return BigInt(this.quoteResponse.inAmount);
  }

  get outputAmount(): bigint {
    return BigInt(this.quoteResponse.outAmount);
  }

  get priceImpact(): number {
    return parseFloat(this.quoteResponse.priceImpactPct);
  }

  get slippageBps(): number {
    return this.quoteResponse.slippageBps;
  }

  get routePlan() {
    return this.quoteResponse.routePlan;
  }

  get rawQuote(): QuoteResponse {
    return this.quoteResponse;
  }

  /**
   * Get swap instructions from the quote
   */
  async getSwapInstructions(userPublicKey?: string): Promise<SwapInstructions> {
    try {
      const response = await fetch(`${JUPITER_API_URL}/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse: this.quoteResponse,
          userPublicKey: userPublicKey || "",
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          feeAccount: undefined,
          computeUnitPriceMicroLamports: "auto",
          prioritizationFeeLamports: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get swap instructions: ${await response.text()}`,
        );
      }

      return response.json();
    } catch (error) {
      console.error("Error getting swap instructions:", error);
      throw new Error(
        `Failed to get swap instructions: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
