import { ErrorOptions } from "./interfaces";

export class GetBalanceError extends Error {

  cause?: unknown;
  
  constructor(message = 'Failed to get balance', options?: ErrorOptions) {
    super(message);
    this.name = 'GetBalanceError';
    this.cause = options?.cause;
  }
}
