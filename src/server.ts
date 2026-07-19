import dotenv from 'dotenv';
dotenv.config();

// Force IPv4 for outbound fetch() calls. Some Windows/local dev
// networks resolve IPv6 first and hang until timeout even when IPv4
// works fine (this is what caused the logo-fetch ConnectTimeoutError
// in ticketEmailTemplate.ts / cocktailEmailTemplate.ts).
import { setGlobalDispatcher, Agent } from 'undici';
setGlobalDispatcher(new Agent({ connect: { family: 4 } as any }));

import app from './app';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';


const startServer = async () => {
  // Connect DB & Redis
  await connectDB();
  await connectRedis();


  // Start server
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();