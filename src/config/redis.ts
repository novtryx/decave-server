import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnecting = false;

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

export const getRedisClient = async (): Promise<RedisClientType> => {
  // If client exists and is connected, return it
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // If client exists but not connected, reconnect
  if (redisClient && !redisClient.isOpen) {
    try {
      await redisClient.connect();
      return redisClient;
    } catch (err) {
      console.error('❌ Redis reconnection failed:', err);
      redisClient = null; // Reset client on failure
    }
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait for the ongoing connection
    await new Promise((resolve) => setTimeout(resolve, 100));
    return getRedisClient(); // Retry
  }

  if (!REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
    throw new Error(
      'Redis is not configured. Set REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD (and optionally REDIS_USERNAME) in the environment.'
    );
  }

  // Create new client
  isConnecting = true;

  try {
    redisClient = createClient({
      username: REDIS_USERNAME,
      password: REDIS_PASSWORD,
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('❌ Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 1000);
        },
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    redisClient.on('end', () => {
      console.log('🔴 Redis connection closed');
    });

    await redisClient.connect();
    console.log('✅ Redis connected');
    
    isConnecting = false;
    return redisClient;
  } catch (err) {
    isConnecting = false;
    console.error('❌ Redis connection failed:', err);
    throw new Error('Failed to connect to Redis');
  }
};

// Legacy connectRedis for backward compatibility
export const connectRedis = async () => {
  return await getRedisClient();
};

// Export for direct access (but not recommended in serverless)
export { redisClient };