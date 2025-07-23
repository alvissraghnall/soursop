import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/soursop', {
      
    });
    console.log('MongoDB connected');
  } catch (err) {
    if (err instanceof Error) {
      
      console.error(err.message);
    }
    process.exit(1);
  }
};


