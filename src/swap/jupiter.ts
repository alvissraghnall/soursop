import fetch from "cross-fetch";
import * as borsh from "borsh";

import {
  address,
  appendTransactionMessageInstructions,
  Base64EncodedBytes,
  compressTransactionMessageUsingAddressLookupTables,
  createSignerFromKeyPair,
  createTransactionMessage,
  fetchAddressesForLookupTables,
  fetchEncodedAccount,
  getAddressDecoder,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  Instruction,
  KeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  signTransactionMessageWithSigners,
  Transaction,
  TransactionWithBlockhashLifetime,
} from "@solana/kit";
import {
  fetchMint,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import { Client, createClient } from "../client";
import { decodeJupiterTransaction } from "../util/decode-jup-transaction";
import { FetchError } from "../errors/fetch.error";
import { convertJupiterInstructionToKit } from "../util/convert-jup-instruction-to-kit";
import { findAssociatedTokenPda } from "@solana-program/token";
import { borshDeserialize, BorshSchema } from "borsher";
import { JupiterQuote, QuoteResponse } from "./jupiter-quote";
import { SOL_MINT } from "../util/constants";
import { logger } from "../util/logger";

function sanitizeString(str: string): string {
  return str.replace(/\0/g, "").trim();
}

export const getTokenInfo = async (tokenMint: string) => {
  const client = await createClient();

  const mintAddress = address(tokenMint);

  const account = await fetchMint(client.rpc, mintAddress);

  return account.data;
};

export const getTokenMetadata = async (tokenMint: string) => {
  let tokenName: string;
  let tokenSymbol: string;
  let tokenLogo;
  let tokenURI: string;

  const mint = address(tokenMint);
  const client = await createClient();
  const addressEncoder = getAddressEncoder();
  const TOKEN_METADATA_PROGRAM_ID = address(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
  );

  const schema = BorshSchema.Struct({
    name: BorshSchema.String,
    symbol: BorshSchema.String,
    uri: BorshSchema.String,
  });

  const seed1 = Buffer.from("metadata");
  const seed2 = addressEncoder.encode(TOKEN_METADATA_PROGRAM_ID);
  const seed3 = addressEncoder.encode(mint);

  const seeds = [seed1, seed2, seed3];

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ID,
    seeds,
  });

  const account = await fetchEncodedAccount(client.rpc, pda);

  if (account.exists) {
    const decoded = borshDeserialize(schema, account.data.slice(65, 319));

    tokenName = sanitizeString(decoded.name);
    tokenSymbol = sanitizeString(decoded.symbol);
    tokenURI = sanitizeString(decoded.uri);

    try {
      const response = await fetch(tokenURI);
      const result = await response.json();
      tokenLogo = result.image;
    } catch (error) {
      tokenLogo = null;
      logger.warn("Failed to fetch token URI: %s", tokenURI);
    } finally {
      const metadata = {
        name: tokenName,
        symbol: tokenSymbol,
        logo: tokenLogo,
      };

      logger.debug(metadata, "Token metadata");
      return metadata;
    }
  }
};

export const getDecimals = async (tokenMint: string) => {
  return (await getTokenInfo(tokenMint)).decimals;
};

// const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const JUPITER_API_URL = "https://lite-api.jup.ag/swap/v1";

interface QuoteRequest {
  inputMint?: string;
  outputMint: string;
  amount: number;
  direction: "buy" | "sell";
  slippageBps?: number;
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
  swapInstruction: JupiterInstructionSet;
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
  slippageBps: number = 300,
): Promise<QuoteResponse> => {
  const inputDecimals = await getDecimals(inputMint);

  // 2. Convert the human-readable amount to the base integer unit
  const amountInBaseUnits = Math.round(humanAmount * 10 ** inputDecimals);

  const url = new URL(`${JUPITER_API_URL}/quote`);
  url.searchParams.append("inputMint", inputMint);
  url.searchParams.append("outputMint", outputMint);
  url.searchParams.append("amount", amountInBaseUnits.toString());
  url.searchParams.append("slippageBps", slippageBps.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to get quote: ${await response.text()}`);
  }
  return response.json();
};

export async function getQuote(params: QuoteRequest): Promise<JupiterQuote> {
  const {
    inputMint = SOL_MINT,
    outputMint,
    amount,
    direction,
    slippageBps = 300,
  } = params;

  try {
    if (!outputMint) {
      throw new Error("Output mint is required");
    }

    if (amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }

    const inputDecimals = await getDecimals(inputMint);

    const quoteResponse = await getJupiterQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps,
    );

    return new JupiterQuote(quoteResponse);
  } catch (error) {
    logger.error(error, "Error getting quote");
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

export async function getBuyQuote(
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 300,
): Promise<JupiterQuote> {
  return getQuote({
    inputMint: SOL_MINT,
    outputMint: tokenMint,
    amount: solAmount,
    direction: "buy",
    slippageBps,
  });
}

export async function getSellQuote(
  tokenMint: string,
  tokenAmount: number,
  slippageBps: number = 300,
): Promise<JupiterQuote> {
  return getQuote({
    inputMint: tokenMint,
    outputMint: SOL_MINT,
    amount: tokenAmount,
    direction: "sell",
    slippageBps,
  });
}

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
  swapInstructionResponse: Partial<SwapInstructionsResponse> &
    Required<
      Pick<
        SwapInstructionsResponse,
        "swapInstruction" | "addressLookupTableAddresses"
      >
    >,
): Promise<
  TransactionWithBlockhashLifetime &
    Transaction &
    NominalType<"transactionSignedness", "fullySigned">
> => {
  const {
    tokenLedgerInstruction,
    computeBudgetInstructions,
    setupInstructions,
    swapInstruction,
    cleanupInstruction,
    addressLookupTableAddresses,
  } = swapInstructionResponse;

  const addr3ss3s = addressLookupTableAddresses.map((addy) => address(addy));

  const addressesForLookupTables = await fetchAddressesForLookupTables(
    addr3ss3s,
    client.rpc,
  );

  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash()
    .send();

  const allInstructions = [
    ...(computeBudgetInstructions?.map(convertJupiterInstructionToKit) || []),
    ...(setupInstructions?.map(convertJupiterInstructionToKit) || []),
    convertJupiterInstructionToKit(swapInstruction),
    ...(cleanupInstruction
      ? [convertJupiterInstructionToKit(cleanupInstruction)]
      : []),
    //    ...(tokenLedgerInstruction ? [convertJupiterInstructionToKit(tokenLedgerInstruction)] : []),
  ];

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(allInstructions, tx),
  );

  const compressedTransactionMessage =
    compressTransactionMessageUsingAddressLookupTables(
      transactionMessage,
      addressesForLookupTables,
    );
  const signedTransaction = await signTransactionMessageWithSigners(
    compressedTransactionMessage,
  );

  return signedTransaction;
};

export const executeSwap = async (
  wallet: CryptoKeyPair,
  swapInstructionResponse: Partial<SwapInstructionsResponse> &
    Required<
      Pick<
        SwapInstructionsResponse,
        "swapInstruction" | "addressLookupTableAddresses"
      >
    >,
): Promise<string> => {
  const client = await createClient();
  const walletSigner = await createSignerFromKeyPair(wallet);

  const signedTransaction = await getSignedSwapTransaction(
    client,
    walletSigner,
    swapInstructionResponse,
  );

  const sig = getSignatureFromTransaction(signedTransaction);

  await client.sendAndConfirmTransaction(signedTransaction, {
    commitment: "confirmed",
  });

  return sig;
};

export const getSwapInstructions = async (
  quoteResponse: QuoteResponse,
  userPublicKey: string,
) => {
  try {
    const response = await fetch(`${JUPITER_API_URL}/swap-instructions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!response.ok) {
      throw new FetchError(
        `Failed to get swap instructions: ${await response.text()}`,
      );
    }

    return await response.json();
  } catch (error) {
    logger.error(error, "Error getting swap instructions");
    throw new Error(
      `Failed to get swap instructions: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const simulateSwap = async (
  walletSigner: KeyPairSigner,
  swapInstructionResponse: Partial<SwapInstructionsResponse> &
    Required<
      Pick<
        SwapInstructionsResponse,
        "swapInstruction" | "addressLookupTableAddresses"
      >
    >,
) => {
  const client = await createClient();

  const signedTransaction = await getSignedSwapTransaction(
    client,
    walletSigner,
    swapInstructionResponse,
  );

  const b64Txn = getBase64EncodedWireTransaction(signedTransaction);

  return client.rpc
    .simulateTransaction(b64Txn, {
      encoding: "base64",
    })
    .send();
};

export const getTokenBalance = async (
  client: Client,
  walletAddress: string,
  tokenMint: string,
): Promise<bigint> => {
  try {
    const [ata] = await findAssociatedTokenPda({
      mint: address(tokenMint),
      owner: address(walletAddress),
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
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
