import {
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  sendAndConfirmTransactionFactory,
} from '@solana/kit';
import { getRequiredEnv } from './util/env-helper';

export type Client = {
  rpc: Rpc<SolanaRpcApi>;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory>;
};

let client: Client | undefined;

export async function createClient(): Promise<Client> {
  if (!client) {
    const rpc = createSolanaRpc('https://' + getRequiredEnv('RPC_URL'));
    const rpcSubscriptions = createSolanaRpcSubscriptions('wss://' + getRequiredEnv('RPC_URL'));

    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
            rpc,
            rpcSubscriptions,
    }); 
    
    client = {
      rpc,
      rpcSubscriptions,
      sendAndConfirmTransaction,
      
    };
  }
  return client;
}
