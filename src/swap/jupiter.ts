import fetch from 'cross-fetch';

import { address, appendTransactionMessageInstructions, Base64EncodedBytes, compileTransaction, compressTransactionMessageUsingAddressLookupTables, createSignerFromKeyPair, createSolanaRpc, createSolanaRpcSubscriptionsFromTransport, createTransactionMessage, fetchAddressesForLookupTables, getAddressDecoder, getBase64EncodedWireTransaction, getComputeUnitEstimateForTransactionMessageFactory, getSignatureFromTransaction, Instruction, KeyPairSigner, pipe, sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransaction, signTransactionMessageWithSigners, SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND, Transaction, TransactionWithBlockhashLifetime } from '@solana/kit';
import { fetchMint, getInitializeScaledUiAmountMintScaledUiAmountMintDiscriminatorBytes, getUpdateMultiplierScaledUiMintInstruction, TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';
import { Client, createClient } from '../client';
import { decodeJupiterTransaction } from '../util/decode-jup-transaction';
import { FetchError } from '../errors/fetch.error';
import { convertJupiterInstructionToKit } from '../util/convert-jup-instruction-to-kit';
import { findAssociatedTokenPda } from '@solana-program/token';

export const getTokenInfo = async (tokenMint: string) => {
  const client = await createClient();

  const mintAddress = address(tokenMint);

  const account = await fetchMint(client.rpc, mintAddress);

  return account.data;
};

export const getDecimals = async (tokenMint: string) => {
  return (await getTokenInfo(tokenMint)).decimals;
}

// const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const JUPITER_API_URL = 'https://lite-api.jup.ag/swap/v1';

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

/**
 * A function that handles getting a quote.
 *
 * @param inputMint The token you are selling.
 * @param outputMint The token you are buying.
 * @param humanAmount The human-readable amount to swap (e.g., 1.5).
 * @param slippageBps The slippage in basis points.
 */
export const getJupiterQuote = async (
  inputMint: string,
  outputMint: string,
  humanAmount: number,
  slippageBps: number
): Promise<QuoteResponse> => {

  const inputDecimals = await getDecimals(inputMint);

  // 2. Convert the human-readable amount to the base integer unit
  const amountInBaseUnits = Math.round(humanAmount * (10 ** inputDecimals));

  const url = new URL(`${JUPITER_API_URL}/quote`);
  url.searchParams.append('inputMint', inputMint);
  url.searchParams.append('outputMint', outputMint);
  url.searchParams.append('amount', amountInBaseUnits.toString());
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

export type NominalType<TKey extends string, TMarker extends string> = {
    readonly [K in `__${TKey}:@solana/kit`]: TMarker;
};

export const getSignedSwapTransaction = async (
  client: Client,
  signer: KeyPairSigner<string>,
  swapInstructionResponse: Partial<SwapInstructionsResponse> & Required<Pick<SwapInstructionsResponse, 'swapInstruction' | 'addressLookupTableAddresses'>>
): Promise<TransactionWithBlockhashLifetime & Transaction & NominalType<"transactionSignedness", "fullySigned">> => {
  
  const { tokenLedgerInstruction, computeBudgetInstructions, setupInstructions, swapInstruction, cleanupInstruction, addressLookupTableAddresses } = 
    swapInstructionResponse;

  const addr3ss3s = addressLookupTableAddresses.map((addy) => address(addy))
  
  const addressesForLookupTables = await fetchAddressesForLookupTables(addr3ss3s, client.rpc)
    
  const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send();

  const allInstructions = [
    ...(computeBudgetInstructions?.map(convertJupiterInstructionToKit) || []),
    ...(setupInstructions?.map(convertJupiterInstructionToKit) || []),
    convertJupiterInstructionToKit(swapInstruction),
    ...(cleanupInstruction ? [convertJupiterInstructionToKit(cleanupInstruction)] : []),
//    ...(tokenLedgerInstruction ? [convertJupiterInstructionToKit(tokenLedgerInstruction)] : []),
  ];

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(allInstructions, tx)
  );

  const compressedTransactionMessage = compressTransactionMessageUsingAddressLookupTables(transactionMessage, addressesForLookupTables);
  const signedTransaction = await signTransactionMessageWithSigners(compressedTransactionMessage);

  return signedTransaction;
}

export const executeSwap = async (
  wallet: CryptoKeyPair,
  swapInstructionResponse: Partial<SwapInstructionsResponse> & Required<Pick<SwapInstructionsResponse, 'swapInstruction' | 'addressLookupTableAddresses'>>
): Promise<string> => {
  const client = await createClient();
  const walletSigner = await createSignerFromKeyPair(wallet);

  const signedTransaction = await getSignedSwapTransaction(client, walletSigner, swapInstructionResponse);
    
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

export const simulateSwap = async (
  walletSigner: KeyPairSigner,
  swapInstructionResponse: Partial<SwapInstructionsResponse> & Required<Pick<SwapInstructionsResponse, 'swapInstruction' | 'addressLookupTableAddresses'>>
) => {
  const client = await createClient();

  const signedTransaction = await getSignedSwapTransaction(client, walletSigner, swapInstructionResponse);
  
  const b64Txn = getBase64EncodedWireTransaction(signedTransaction);

  return client.rpc.simulateTransaction(b64Txn, {
    encoding: 'base64'
  }).send();
}

export const getTokenBalance = async (
  client: Client,
  walletAddress: string,
  tokenMint: string
): Promise<bigint> => {


  try {
    const [ata] = await findAssociatedTokenPda({
      mint: address(tokenMint),
      owner: address(walletAddress),
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
    });

    const accountBal = await client.rpc.getTokenAccountBalance(ata).send();
    if (!accountBal.value) {
      return 0n; // Account doesn't exist, so balance is 0
    }

    return BigInt(accountBal.value.amount);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    } else {
      
      return 0n;
    }
  }
};
