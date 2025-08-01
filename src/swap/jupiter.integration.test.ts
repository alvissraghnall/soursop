import { createKeyPairSignerFromPrivateKeyBytes, generateKeyPair, generateKeyPairSigner, getUtf8Encoder, signBytes, verifySignature } from "@solana/kit";
import { getJupiterQuote, getSwapInstructions, simulateSwap } from "./jupiter";
import { getRequiredEnv } from "../util/env-helper";

describe('Swap Actual Test', () => {

  
  it(
    'should get a real quote and successfully simulate the transaction',
    async () => {
      const privateKey = JSON.parse(getRequiredEnv('ACTUAL_TEST_PRIVATE_KEY')) as Array<number>;

      console.log(privateKey);
      const privateKeyBuf = new Uint8Array(privateKey.slice(0, 32));
      
//      const privateKeyPkcs8 = await crypto.subtle.importKey('pkcs8', privateKeyBuf, { name: "Ed25519" }, false, ['sign']);

      const walletSigner = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBuf, false);

      const testMessage = getUtf8Encoder().encode('The meeting is at 6:00pm');
      const testSignature = await signBytes(walletSigner.keyPair.privateKey, testMessage);

      const verificationSucceeded = await verifySignature(
          walletSigner.keyPair.publicKey,
          testSignature,
          getUtf8Encoder().encode('The meeting is at 6:00pm'),
      );
      expect(verificationSucceeded).toBe(true);
      
      const quoteResponse = await getJupiterQuote(
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
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

      console.log('✅ Successfully simulated a mainnet transaction.');
      console.log(`- Transaction logs: ${simulationResult.value.logs?.length} lines`);
      console.log(simulationResult.value);
    },
    30000
  );
});
