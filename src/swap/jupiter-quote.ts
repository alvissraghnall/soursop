export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export class JupiterQuote {
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
}
