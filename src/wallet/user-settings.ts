import {
  prop,
  getModelForClass,
  modelOptions,
  ReturnModelType,
} from "@typegoose/typegoose";

@modelOptions({ schemaOptions: { timestamps: true } })
class UserSettings {
  @prop({ required: true, unique: true })
  userId!: number;

  @prop({ default: 300 })
  slippageBps!: number;

  @prop()
  defaultWalletAddress?: string;
}

export const UserSettingsModel = getModelForClass(UserSettings);
