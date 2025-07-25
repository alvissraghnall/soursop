import { 
  getBase64Encoder,
  getBase64Codec,
  getCompiledTransactionMessageCodec,
  getTransactionCodec
} from '@solana/kit';

export const decodeJupiterTransaction = (base64Transaction: string) => {
  const base64Codec = getBase64Codec();
  const transactionBytes = base64Codec.encode(base64Transaction);
  
  const transactionCodec = getTransactionCodec();
  const transaction = transactionCodec.decode(transactionBytes);
  
  const messageCodec = getCompiledTransactionMessageCodec();
  const message = messageCodec.decode(transaction.messageBytes);
  
  return {
    ...transaction,
    message,
    signatures: transaction.signatures,
  };
};
