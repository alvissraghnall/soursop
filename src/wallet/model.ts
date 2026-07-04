import {
  prop,
  getModelForClass,
  modelOptions,
  ReturnModelType,
  DocumentType,
} from "@typegoose/typegoose";
import { MongoError, MongoServerError } from "mongodb";
import mongoose from "mongoose";
import { logger } from "../util/logger";

@modelOptions({ schemaOptions: { timestamps: true } })
class Wallet {
  @prop({ required: true })
  userId!: number;

  @prop({ required: true, unique: true })
  address!: string;

  @prop({ required: true, unique: true })
  encryptedPrivateKey!: string;

  @prop()
  encryptedMnemonic?: string;

  @prop({ default: false })
  default!: boolean;

  @prop({ default: Date.now })
  createdAt?: Date;

  static async findByUserId(
    this: ReturnModelType<typeof Wallet>,
    userId: number,
  ) {
    return this.findOne({ userId });
  }

  static async createAndSave(
    this: ReturnModelType<typeof Wallet>,
    data: {
      userId: number;
      address: string;
      encryptedPrivateKey: string;
      encryptedMnemonic?: string;
    },
  ) {
    try {
      const existingWallets = await this.find({ userId: data.userId });

      const isDefault = existingWallets.length === 0;

      const wallet = new this({
        ...data,
        default: isDefault,
      });

      return await wallet.save();
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        const field = Object.keys(error.keyPattern ?? {})[0];
        throw new Error(`Duplicate value for field: ${field}`);
      }

      throw error;
    }
  }

  static async setDefaultWallet(
    this: ReturnModelType<typeof Wallet>,
    userId: number,
    walletId: string | mongoose.Types.ObjectId,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await this.updateMany(
        { userId },
        { $set: { default: false } },
        { session },
      );

      const updatedWallet = await this.findByIdAndUpdate(
        walletId,
        { $set: { default: true } },
        { new: true, session },
      );

      await session.commitTransaction();
      return updatedWallet;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const WalletModel = getModelForClass(Wallet);
