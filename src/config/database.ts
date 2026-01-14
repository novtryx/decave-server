import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('MongoDB connection error: MONGO_URI is not defined');
    process.exit(1); // Stop the server if URI missing
  }

  try {
    await mongoose.connect(mongoUri, {
      autoIndex: true,                   // builds indexes
      serverSelectionTimeoutMS: 20000,   // 10 seconds
    });

    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1); // stop the process
  }
};
