import { prop, getModelForClass, modelOptions, ReturnModelType, DocumentType } from '@typegoose/typegoose';
import { MongoError, MongoServerError } from 'mongodb';

@modelOptions({ schemaOptions: { timestamps: true } })
class Wallet {
  @prop({ required: true, unique: true })
  userId!: number;

  @prop({ required: true, unique: true })
  address!: string;

  @prop({ required: true, unique: true })
  encryptedPrivateKey!: string;

  @prop()
  encryptedMnemonic?: string;

  @prop({ default: Date.now })
  createdAt?: Date;

  static async findByUserId(this: ReturnModelType<typeof Wallet>, userId: number) {
    return this.findOne({ userId });
  }

  static async createAndSave(this: ReturnModelType<typeof Wallet>, data: {
    userId: number;
    address: string;
    encryptedPrivateKey: string;
    encryptedMnemonic?: string;
  }) {

    try {
      const wallet = new this(data);
      return await wallet.save();
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const field = Object.keys(error.keyPattern ?? {})[0];
        throw new Error(`Duplicate value for field: ${field}`);
      }
      throw error;
    }
  
  }
}

export const WalletModel = getModelForClass(Wallet);
