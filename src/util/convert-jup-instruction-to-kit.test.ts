import { convertJupiterInstructionToKit } from './convert-jup-instruction-to-kit';
import { AccountRole, type Instruction } from '@solana/instructions';
import { address as mockAddress } from '@solana/kit';

jest.mock('@solana/kit', () => ({
  address: jest.fn((addr) => `converted:${addr}`),
}));

describe('convertJupiterInstructionToKit', () => {
  const base64Data = Buffer.from('deadbeef', 'hex').toString('base64');
  const expectedData = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('converts full instruction with multiple accounts and data', () => {
    const input = {
      programId: 'Program111111',
      data: base64Data,
      accounts: [
        { pubkey: 'Account1', isSigner: true, isWritable: true },
        { pubkey: 'Account2', isSigner: true, isWritable: false },
        { pubkey: 'Account3', isSigner: false, isWritable: true },
        { pubkey: 'Account4', isSigner: false, isWritable: false },
      ],
    };

    const result = convertJupiterInstructionToKit(input);

    expect(result).toEqual({
      programAddress: 'converted:Program111111',
      data: expectedData,
      accounts: [
        { address: 'converted:Account1', role: AccountRole.WRITABLE_SIGNER },
        { address: 'converted:Account2', role: AccountRole.READONLY_SIGNER },
        { address: 'converted:Account3', role: AccountRole.WRITABLE },
        { address: 'converted:Account4', role: AccountRole.READONLY },
      ],
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.accounts)).toBe(true);
    result.accounts?.forEach(acc => expect(Object.isFrozen(acc)).toBe(true));
  });

  test('handles instruction with no accounts and no data', () => {
    const input = {
      programId: 'ProgramXYZ',
      data: '',
      accounts: [],
    };

    const result = convertJupiterInstructionToKit(input);

    expect(result).toEqual({
      programAddress: 'converted:ProgramXYZ',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.accounts).toBeUndefined();
    expect(result.data).toBeUndefined();
  });

  test('handles undefined data', () => {
    const input = {
      programId: 'ProgramABC',
      data: undefined as unknown as string,
      accounts: [],
    };

    const result = convertJupiterInstructionToKit(input);

    expect(result).toEqual({
      programAddress: 'converted:ProgramABC',
    });
  });

  test('handles only data, no accounts', () => {
    const input = {
      programId: 'ProgramOnlyData',
      data: base64Data,
      accounts: [],
    };

    const result = convertJupiterInstructionToKit(input);

    expect(result).toEqual({
      programAddress: 'converted:ProgramOnlyData',
      data: expectedData,
    });

    expect(Object.isFrozen(result)).toBe(true);
  });

  test('handles only accounts, no data', () => {
    const input = {
      programId: 'ProgramOnlyAccounts',
      data: '',
      accounts: [
        { pubkey: 'OnlyAccount', isSigner: true, isWritable: false },
      ],
    };

    const result = convertJupiterInstructionToKit(input);

    expect(result).toEqual({
      programAddress: 'converted:ProgramOnlyAccounts',
      accounts: [
        { address: 'converted:OnlyAccount', role: AccountRole.READONLY_SIGNER },
      ],
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.accounts)).toBe(true);
  });

  test('freezes nested objects', () => {
    const input = {
      programId: 'FrozenCheck',
      data: base64Data,
      accounts: [
        { pubkey: 'FrozenAccount', isSigner: true, isWritable: true },
      ],
    };

    const result = convertJupiterInstructionToKit(input);

    expect(() => {
      // @ts-expect-error test immutability
      result.programAddress = 'tampered';
    }).toThrow();

    expect(() => {
      // @ts-expect-error test immutability
      result.accounts[0].role = AccountRole.READONLY;
    }).toThrow();
  });
});
