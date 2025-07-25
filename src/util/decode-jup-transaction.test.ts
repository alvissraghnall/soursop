import {
  getBase64Codec,
  getTransactionCodec,
  getCompiledTransactionMessageCodec,
} from '@solana/kit';
import { decodeJupiterTransaction } from './decode-jup-transaction';

jest.mock('@solana/kit', () => ({
  getBase64Codec: jest.fn(),
  getTransactionCodec: jest.fn(),
  getCompiledTransactionMessageCodec: jest.fn(),
}));

describe('decodeJupiterTransaction', () => {
  const mockBase64Codec = { encode: jest.fn() };
  const mockTransactionCodec = { decode: jest.fn() };
  const mockMessageCodec = { decode: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (getBase64Codec as jest.Mock).mockReturnValue(mockBase64Codec);
    (getTransactionCodec as jest.Mock).mockReturnValue(mockTransactionCodec);
    (getCompiledTransactionMessageCodec as jest.Mock).mockReturnValue(mockMessageCodec);
  });

  it('decodes base64 transaction and returns transaction with decoded message', () => {
    const base64Input = 'dGVzdC1iYXNlNjQ=';
    const transactionBytes = new Uint8Array([1, 2, 3]);
    const transaction = {
      messageBytes: new Uint8Array([4, 5, 6]),
      signatures: ['signature1'],
      otherField: 'value',
    };
    const decodedMessage = { instructions: [] };

    mockBase64Codec.encode.mockReturnValue(transactionBytes);
    mockTransactionCodec.decode.mockReturnValue(transaction);
    mockMessageCodec.decode.mockReturnValue(decodedMessage);

    const result = decodeJupiterTransaction(base64Input);

    expect(getBase64Codec).toHaveBeenCalled();
    expect(getTransactionCodec).toHaveBeenCalled();
    expect(getCompiledTransactionMessageCodec).toHaveBeenCalled();
    expect(mockBase64Codec.encode).toHaveBeenCalledWith(base64Input);
    expect(mockTransactionCodec.decode).toHaveBeenCalledWith(transactionBytes);
    expect(mockMessageCodec.decode).toHaveBeenCalledWith(transaction.messageBytes);

    expect(result).toEqual({
      ...transaction,
      message: decodedMessage,
      signatures: transaction.signatures,
    });
  });

  it('returns expected fields even if transaction has extra properties', () => {
    const base64Input = 'dGVzdA==';
    const transactionBytes = new Uint8Array([10, 20]);
    const transaction = {
      messageBytes: new Uint8Array([30, 40]),
      signatures: ['sigX'],
      meta: 'extra',
    };
    const decodedMessage = { instructions: ['ix'] };

    mockBase64Codec.encode.mockReturnValue(transactionBytes);
    mockTransactionCodec.decode.mockReturnValue(transaction);
    mockMessageCodec.decode.mockReturnValue(decodedMessage);

    const result = decodeJupiterTransaction(base64Input);

    expect(result).toMatchObject({
      message: decodedMessage,
      signatures: ['sigX'],
      meta: 'extra',
    });
  });

  it('handles empty signatures and messageBytes', () => {
    const base64Input = 'dGVzdDI=';
    const transactionBytes = new Uint8Array([0]);
    const transaction = {
      messageBytes: new Uint8Array([]),
      signatures: [],
    };
    const decodedMessage = {};

    mockBase64Codec.encode.mockReturnValue(transactionBytes);
    mockTransactionCodec.decode.mockReturnValue(transaction);
    mockMessageCodec.decode.mockReturnValue(decodedMessage);

    const result = decodeJupiterTransaction(base64Input);

    expect(result).toEqual({
      ...transaction,
      message: decodedMessage,
      signatures: [],
    });
  });
});
