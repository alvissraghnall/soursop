
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { WalletModel } from './model';

const walletData1 = {
  userId: 101,
  address: '0xAddressOne',
  encryptedPrivateKey: 'privateKeyOne',
  encryptedMnemonic: 'word1 word2 word3',
};

const walletData2 = {
  userId: 102,
  address: '0xAddressTwo',
  encryptedPrivateKey: 'privateKeyTwo',
};


describe('Wallet Model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await WalletModel.deleteMany({});
  });


  describe('static method: createAndSave', () => {
    it('✅ should create and save a new wallet successfully', async () => {
      const savedWallet = await WalletModel.createAndSave(walletData1);

      expect(savedWallet._id).toBeDefined();
      expect(savedWallet.userId).toBe(walletData1.userId);
      expect(savedWallet.address).toBe(walletData1.address);
      expect(savedWallet.encryptedMnemonic).toBe(walletData1.encryptedMnemonic);
      expect(savedWallet.createdAt).toBeInstanceOf(Date);

      const foundInDb = await WalletModel.findById(savedWallet._id);
      expect(foundInDb).not.toBeNull();
      expect(foundInDb?.userId).toBe(walletData1.userId);
    });

    it('❌ should throw a custom error for a duplicate address', async () => {
      await WalletModel.createAndSave(walletData1);

      const duplicateData = { ...walletData2, address: walletData1.address };

      await expect(WalletModel.createAndSave(duplicateData)).rejects.toThrow(
        'Duplicate value for field: address'
      );
    });
    
    it('❌ should throw a custom error for a duplicate encryptedPrivateKey', async () => {
        await WalletModel.createAndSave(walletData1);
  
        const duplicateData = { ...walletData2, encryptedPrivateKey: walletData1.encryptedPrivateKey };
  
        await expect(WalletModel.createAndSave(duplicateData)).rejects.toThrow(
          'Duplicate value for field: encryptedPrivateKey'
        );
      });

    it('❌ should re-throw a Mongoose validation error if a required field is missing', async () => {
      const invalidData = {
        address: '0xInvalidAddress',
        encryptedPrivateKey: 'someKey',
      };

      await expect(WalletModel.createAndSave(invalidData as any)).rejects.toThrow(
        'Wallet validation failed: userId: Path `userId` is required.'
      );
    });
  });

  
  describe('static method: findByUserId', () => {
    it('✅ should find and return an existing wallet by its userId', async () => {
      await WalletModel.createAndSave(walletData1);
      
      const foundWallet = await WalletModel.findByUserId(walletData1.userId);

      expect(foundWallet).not.toBeNull();
      expect(foundWallet?.userId).toBe(walletData1.userId);
      expect(foundWallet?.address).toBe(walletData1.address);
    });

    it('❓ should return null if no wallet with the given userId exists', async () => {
      const nonExistentUserId = 9999;
      
      const foundWallet = await WalletModel.findByUserId(nonExistentUserId);
      
      expect(foundWallet).toBeNull();
    });
  });
});
