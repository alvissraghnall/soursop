import fetch from 'cross-fetch';

import { TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { address, appendTransactionMessageInstructions, compileTransaction, createSignerFromKeyPair, createSolanaRpc, createSolanaRpcSubscriptionsFromTransport, createTransactionMessage, getSignatureFromTransaction, Instruction, pipe, sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransaction, signTransactionMessageWithSigners, SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND } from '@solana/kit';
import { fetchMint, getUpdateMultiplierScaledUiMintInstruction } from '@solana-program/token-2022';
import { createClient } from '../client';
import { decodeJupiterTransaction } from '../util/decode-jup-transaction';
import { FetchError } from '../errors/fetch.error';
import { convertJupiterInstructionToKit } from '../util/convert-jup-instruction-to-kit';

export const getDecimals = async (tokenMint: string) => {
  const client = await createClient();

  const mintAddress = address(tokenMint);

  const account = await fetchMint(client.rpc, mintAddress);

  const decimals = account.data.decimals;

  console.log(`Token decimals: ${decimals}`);
  return decimals;
};

const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

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
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

interface JupiterInstructionSet {
  programId: string;
  accounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: string;
}

export interface SwapInstructionsResponse {
    readonly tokenLedgerInstruction?: JupiterInstructionSet;
    otherInstructions?: Array<JupiterInstructionSet>;
    computeBudgetInstructions: Array<JupiterInstructionSet>;
    setupInstructions: Array<JupiterInstructionSet>;
    swapInstruction: JupiterInstructionSet
    cleanupInstruction?: JupiterInstructionSet;
    addressLookupTableAddresses: Array<string>;
}

export const getJupiterQuote = async (
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<QuoteResponse> => {
  const amountInSmallestUnit = Math.floor(amount * 10 ** 6);

  const url = new URL(`${JUPITER_API_URL}/quote`);
  url.searchParams.append('inputMint', inputMint);
  url.searchParams.append('outputMint', outputMint);
  url.searchParams.append('amount', amountInSmallestUnit.toString());
  url.searchParams.append('slippageBps', slippageBps.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to get quote: ${await response.text()}`);
  }
  return response.json();
};


/**
export const getSwapTransaction = async (
  quoteResponse: QuoteResponse,
  userPublicKey: string
) => {
  const response = await fetch(`${JUPITER_API_URL}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get swap transaction: ${await response.text()}`);
  }

  const { swapTransaction } = await response.json();
  const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
  return decodeJupiterTransaction(swapTransaction);

};

export const executeSwap = async (
  wallet: CryptoKeyPair,
  swapTransaction: VersionedTransaction
): Promise<string> => {
  const client = createClient();
  swapTransaction.sign([wallet]);

  const rawTransaction = swapTransaction.serialize();
  const txid = await client.rpc.sendTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 2,
  });

  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txid,
  }, 'confirmed');

  return txid;
};

*/

export const executeSwap = async (
  wallet: CryptoKeyPair,
  swapInstructionResponse: Partial<SwapInstructionsResponse> & Required<Pick<SwapInstructionsResponse, 'swapInstruction'>>
): Promise<string> => {
  const client = await createClient();
  const walletSigner = await createSignerFromKeyPair(wallet);

  const { tokenLedgerInstruction, computeBudgetInstructions, setupInstructions, swapInstruction, cleanupInstruction } = 
    swapInstructionResponse;


  const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send();

  const allInstructions = [
    ...(computeBudgetInstructions?.map(convertJupiterInstructionToKit) || []),
    ...(setupInstructions?.map(convertJupiterInstructionToKit) || []),
    convertJupiterInstructionToKit(swapInstruction),
    ...(cleanupInstruction ? [convertJupiterInstructionToKit(cleanupInstruction)] : []),
    ...(tokenLedgerInstruction ? [convertJupiterInstructionToKit(tokenLedgerInstruction)] : []),
  ];

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(walletSigner, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(allInstructions, tx)
  );

  const compiledTransaction = compileTransaction(transactionMessage);
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    
  const sig = getSignatureFromTransaction(signedTransaction);
  
  await client.sendAndConfirmTransaction(signedTransaction, { 
    commitment: 'confirmed'
  });

  return sig;
};

export const getSwapInstructions = async (
  quoteResponse: QuoteResponse,
  userPublicKey: string
) => {
  const response = await fetch(`${JUPITER_API_URL}/swap-instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
    }),
  });

  if (!response.ok) {
    throw new FetchError(`Failed to get swap instructions: ${await response.text()}`);
  }

  return await response.json();
};


