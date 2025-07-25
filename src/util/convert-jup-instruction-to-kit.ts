import { AccountRole, type Instruction } from '@solana/instructions';
import { address } from '@solana/kit';

export function convertJupiterInstructionToKit(jupiterInstruction: {
  programId: string;
  accounts: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: string;
}): Instruction {
  const data = jupiterInstruction.data 
    ? Uint8Array.from(Buffer.from(jupiterInstruction.data, 'base64'))
    : undefined;

  const accounts = jupiterInstruction.accounts.map(account =>
    Object.freeze({
      address: address(account.pubkey),
      role: determineRole(account.isSigner, account.isWritable),
    }),
  );

  return Object.freeze({
    ...(accounts.length ? { accounts: Object.freeze(accounts) } : null),
    ...(data ? { data } : null),
    programAddress: address(jupiterInstruction.programId),
  });
}

function determineRole(isSigner: boolean, isWritable: boolean): AccountRole {
  if (isSigner && isWritable) return AccountRole.WRITABLE_SIGNER;
  if (isSigner) return AccountRole.READONLY_SIGNER;
  if (isWritable) return AccountRole.WRITABLE;
  return AccountRole.READONLY;
}
