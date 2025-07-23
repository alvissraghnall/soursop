import { prop, getModelForClass, modelOptions, ReturnModelType, DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { timestamps: true } })
class Wallet {
  @prop({ required: true })
  userId!: number;

  @prop({ required: true })
  address!: string;

  @prop({ required: true })
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
    const wallet = new this(data);
    return wallet.save();
  }
}

export const WalletModel = getModelForClass(Wallet);
