import mongoose from "mongoose";
import { logger } from "./util/logger";

export const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/soursop",
      {},
    );
    logger.info("MongoDB connected");
  } catch (err) {
    if (err instanceof Error) {
      logger.error(err, "MongoDB connection error");
    }
    process.exit(1);
  }
};
