
import fetch from 'cross-fetch';
import { executeSwap, getDecimals, getJupiterQuote, getSwapInstructions, QuoteResponse, SwapInstructionsResponse } from './jupiter';
import { createClient } from '../client';
import { fetchMint } from '@solana-program/token-2022';
import { address } from '@solana/kit';
import { FetchError } from '../errors/fetch.error';

import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getSignatureFromTransaction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  Instruction,
  createSignerFromKeyPair
} from '@solana/kit';
import { convertJupiterInstructionToKit } from '../util/convert-jup-instruction-to-kit';


jest.mock('../client');
jest.mock('../util/convert-jup-instruction-to-kit');
jest.mock('@solana/kit', () => ({
  ...jest.requireActual('@solana/kit'),
  createTransactionMessage: jest.fn(),
  createSignerFromKeyPair: jest.fn(),
  setTransactionMessageFeePayerSigner: jest.fn(),
  setTransactionMessageLifetimeUsingBlockhash: jest.fn(),
  appendTransactionMessageInstructions: jest.fn(),
  compileTransaction: jest.fn(),
  signTransactionMessageWithSigners: jest.fn(),
  getSignatureFromTransaction: jest.fn(),
  address: jest.fn(mint => `mock-address-${mint}`),
}));
jest.mock('cross-fetch');
jest.mock('../errors/fetch.error', () => ({
  FetchError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'FetchError';
    }
  },
}));
jest.mock('@solana-program/token-2022', () => ({
  ...jest.requireActual('@solana-program/token-2022'),
  fetchMint: jest.fn(),
}));

const mockedCreateSignerFromKeyPair = createSignerFromKeyPair as jest.Mock;
const mockedConvertJupiterInstructionToKit = convertJupiterInstructionToKit as jest.Mock;
const mockedCreateTransactionMessage = createTransactionMessage as jest.Mock;
const mockedSetTransactionMessageFeePayerSigner = setTransactionMessageFeePayerSigner as jest.Mock;
const mockedSetTransactionMessageLifetimeUsingBlockhash = setTransactionMessageLifetimeUsingBlockhash as jest.Mock;
const mockedAppendTransactionMessageInstructions = appendTransactionMessageInstructions as jest.Mock;
const mockedCompileTransaction = compileTransaction as jest.Mock;
const mockedSignTransactionMessageWithSigners = signTransactionMessageWithSigners as jest.Mock;
const mockedGetSignatureFromTransaction = getSignatureFromTransaction as jest.Mock;


const mockFetch = fetch as jest.Mock;
const mockCreateClient = createClient as jest.Mock;
const mockFetchMint = fetchMint as jest.Mock;
const mockAddress = address as jest.Mock;

describe('jupiter', () => {
  let consoleLogSpy: jest.SpyInstance;
  const mockWallet = { publicKey: 'pub', privateKey: 'priv' } as unknown as CryptoKeyPair;
  const mockSigner = { address: 'mockSignerAddress' };
  const mockLatestBlockhash = { blockhash: 'mockBlockhash', lastValidBlockHeight: 123 };
  const mockSignature = 'mockTransactionSignature';

  const mockClient = {
    rpc: {
      getLatestBlockhash: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue({ value: mockLatestBlockhash }),
      }),
    },
    sendAndConfirmTransaction: jest.fn().mockResolvedValue(mockSignature),
  };

  const mockJupiterInstruction = {
    programId: 'programId',
    accounts: [],
    data: 'data',
  };

  const mockKitInstruction: Instruction = {
    programAddress: address('programId'),
    accounts: [],
    data: Buffer.from('data', 'base64'),
  };

  const mockSwapInstructions: SwapInstructionsResponse = {
    tokenLedgerInstruction: mockJupiterInstruction,
    computeBudgetInstructions: [mockJupiterInstruction],
    setupInstructions: [mockJupiterInstruction],
    swapInstruction: mockJupiterInstruction,
    cleanupInstruction: mockJupiterInstruction,
    addressLookupTableAddresses: ['mock'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockCreateClient.mockResolvedValue(mockClient);
    mockedCreateSignerFromKeyPair.mockResolvedValue(mockSigner);
    mockedConvertJupiterInstructionToKit.mockReturnValue(mockKitInstruction);

    const mockTxMessage = { message: 'initial' };
    mockedCreateTransactionMessage.mockReturnValue(mockTxMessage);
    mockedSetTransactionMessageFeePayerSigner.mockImplementation((_, tx) => ({ ...tx, feePayer: 'set' }));
    mockedSetTransactionMessageLifetimeUsingBlockhash.mockImplementation((_, tx) => ({ ...tx, lifetime: 'set' }));
    const finalMockTxMessage = { message: 'final' };
    mockedAppendTransactionMessageInstructions.mockReturnValue(finalMockTxMessage);

    const mockCompiledTx = { compiled: true };
    const mockSignedTx = { signed: true };
    mockedCompileTransaction.mockReturnValue(mockCompiledTx);
    mockedSignTransactionMessageWithSigners.mockResolvedValue(mockSignedTx);
    mockedGetSignatureFromTransaction.mockReturnValue(mockSignature);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('getDecimals', () => {
    it('should fetch and return the decimals for a given token mint', async () => {
      const mockRpc: any = { rpc: 'mock-rpc' };
      const mockMintAccount = {
        data: {
          decimals: 9,
        },
      };
      const tokenMint = 'So11111111111111111111111111111111111111112';
      const mockMintAddress = `mock-address-${tokenMint}`;

      mockCreateClient.mockResolvedValue(mockRpc);
      mockFetchMint.mockResolvedValue(mockMintAccount);
      mockAddress.mockReturnValue(mockMintAddress);

      const decimals = await getDecimals(tokenMint);

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      expect(mockAddress).toHaveBeenCalledWith(tokenMint);
      expect(mockFetchMint).toHaveBeenCalledWith(mockRpc.rpc, mockMintAddress);
      expect(decimals).toBe(9);
      expect(consoleLogSpy).toHaveBeenCalledWith('Token decimals: 9');
    });

    it('should handle mints with zero decimals', async () => {
      const mockRpc: any = { rpc: 'mock-rpc' };
      const mockMintAccount = {
        data: {
          decimals: 0,
        },
      };
      const tokenMint = 'NFT11111111111111111111111111111111111111111';
      const mockMintAddress = `mock-address-${tokenMint}`;

      mockCreateClient.mockResolvedValue(mockRpc);
      mockFetchMint.mockResolvedValue(mockMintAccount);
      mockAddress.mockReturnValue(mockMintAddress);

      const decimals = await getDecimals(tokenMint);

      expect(decimals).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalledWith('Token decimals: 0');
    });
  });

  describe('getJupiterQuote', () => {
    const inputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    const outputMint = 'So11111111111111111111111111111111111111112'; // SOL
    const amount = 1.5;
    const slippageBps = 50;

    const mockQuoteResponse: QuoteResponse = {
      inputMint,
      inAmount: '1500000',
      outputMint,
      outAmount: '10000000',
      otherAmountThreshold: '9950000',
      swapMode: 'ExactIn',
      slippageBps: 50,
      platformFee: {
        amount: '1000',
        feeBps: 10,
      },
      priceImpactPct: '0.01',
      routePlan: [],
      contextSlot: 123456,
      timeTaken: 0.5,
    };

    it('should fetch a quote successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const quote = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);

      const expectedAmountInSmallestUnit = Math.floor(amount * 10 ** 6);
      const expectedUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${expectedAmountInSmallestUnit}&slippageBps=${slippageBps}`;

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
      expect(quote).toEqual(mockQuoteResponse);
    });

    it('should correctly calculate amount in smallest unit', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const testAmount = 0.05;
      await getJupiterQuote(inputMint, outputMint, testAmount, slippageBps);

      const expectedAmount = Math.floor(testAmount * 10 ** 6);
      const capturedUrl = new URL(mockFetch.mock.calls[0][0]);

      expect(capturedUrl.searchParams.get('amount')).toBe(expectedAmount.toString());
    });

    it('should throw an error if the fetch request fails', async () => {
      const errorMessage = 'Internal Server Error';
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(errorMessage),
      });

      await expect(getJupiterQuote(inputMint, outputMint, amount, slippageBps)).rejects.toThrow(
        `Failed to get quote: ${errorMessage}`
      );
    });

    it('should throw an error if the network request itself fails', async () => {
        const networkError = new Error('Network failed');
        mockFetch.mockRejectedValue(networkError);

        await expect(getJupiterQuote(inputMint, outputMint, amount, slippageBps)).rejects.toThrow(networkError);
    });
  });

  describe('getSwapInstructions', () => {
    const mockUserPublicKey = 'user42publicKeY111111111111111111111111111';
    const mockQuoteResponse: QuoteResponse = {
      inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inAmount: '1000000',
      outputMint: 'So11111111111111111111111111111111111111112',
      outAmount: '5000000',
      otherAmountThreshold: '4975000',
      swapMode: 'ExactIn',
      slippageBps: 50,
      platformFee: { amount: '0', feeBps: 0 },
      priceImpactPct: '0.001',
      routePlan: [],
      contextSlot: 123,
      timeTaken: 1,
    };

    const mockSwapInstructionsResponse: SwapInstructionsResponse = {
      computeBudgetInstructions: [],
      setupInstructions: [],
      swapInstruction: {
        programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
        accounts: [],
        data: 'mockSwapData',
      },
      addressLookupTableAddresses: [],
    };

    it('should fetch swap instructions successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSwapInstructionsResponse),
      });

      const result = await getSwapInstructions(mockQuoteResponse, mockUserPublicKey);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://quote-api.jup.ag/v6/swap-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: mockQuoteResponse,
          userPublicKey: mockUserPublicKey,
          wrapAndUnwrapSol: true,
        }),
      });
      expect(result).toEqual(mockSwapInstructionsResponse);
    });

    it('should throw a FetchError if the response is not ok', async () => {
      const errorText = 'Invalid quote response';
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(errorText),
      });

      await expect(getSwapInstructions(mockQuoteResponse, mockUserPublicKey)).rejects.toThrow(
        new FetchError(`Failed to get swap instructions: ${errorText}`)
      );
    });

    it('should propagate network errors', async () => {
      const networkError = new Error('Failed to connect');
      mockFetch.mockRejectedValue(networkError);

      await expect(getSwapInstructions(mockQuoteResponse, mockUserPublicKey)).rejects.toThrow(networkError);
    });
  });

  
  describe('executeSwap', () => {
      it('should successfully execute a swap with all instructions', async () => {
      const result = await executeSwap(mockWallet, mockSwapInstructions);

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      expect(mockedCreateSignerFromKeyPair).toHaveBeenCalledWith(mockWallet);
      expect(mockClient.rpc.getLatestBlockhash().send).toHaveBeenCalledTimes(1);

      expect(mockedConvertJupiterInstructionToKit).toHaveBeenCalledTimes(5);

      expect(mockedCreateTransactionMessage).toHaveBeenCalledWith({ version: 0 });
      expect(mockedSetTransactionMessageFeePayerSigner).toHaveBeenCalledWith(mockSigner, expect.any(Object));
      expect(mockedSetTransactionMessageLifetimeUsingBlockhash).toHaveBeenCalledWith(mockLatestBlockhash, expect.any(Object));

      const expectedInstructions = Array(5).fill(mockKitInstruction);
      expect(mockedAppendTransactionMessageInstructions).toHaveBeenCalledWith(expectedInstructions, expect.any(Object));

      const signedTx = await mockedSignTransactionMessageWithSigners.mock.results[0].value;
      expect(mockClient.sendAndConfirmTransaction).toHaveBeenCalledWith(signedTx, { commitment: 'confirmed' });
      expect(result).toBe(mockSignature);
    });

    it('should handle missing optional instructions', async () => {
      const minimalSwapInstructions: Partial<SwapInstructionsResponse> & Required<Pick<SwapInstructionsResponse, 'swapInstruction'>> = {
        swapInstruction: mockJupiterInstruction,
      };

      await executeSwap(mockWallet, minimalSwapInstructions);

      expect(mockedConvertJupiterInstructionToKit).toHaveBeenCalledTimes(1);
      expect(mockedConvertJupiterInstructionToKit).toHaveBeenCalledWith(mockJupiterInstruction);

      const expectedInstructions = [mockKitInstruction];
      expect(mockedAppendTransactionMessageInstructions).toHaveBeenCalledWith(expectedInstructions, expect.any(Object));
    });

    it('should propagate errors from sendAndConfirmTransaction', async () => {
      const error = new Error('Transaction failed');
      mockClient.sendAndConfirmTransaction.mockRejectedValue(error);

      await expect(executeSwap(mockWallet, mockSwapInstructions)).rejects.toThrow('Transaction failed');
    });
  });
});

