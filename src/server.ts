import dotenv from 'dotenv';
dotenv.config();
import app from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';


const startServer = async () => {
  // Connect DB & Redis
  await connectDB();
  await connectRedis();


  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();
 