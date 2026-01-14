import { createClient, RedisClientType } from 'redis';

export let redisClient: RedisClientType;

export const connectRedis = async () => {
  redisClient = createClient({
    username: 'default',
    password: '2Wea7fBv84SKm6XkC2MvZ5jn7XvRyyWZ',
    socket: {
      host: 'redis-11468.c341.af-south-1-1.ec2.cloud.redislabs.com',
      port: 11468,
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
  });

  try {
    await redisClient.connect();
    console.log('✅ Redis connected');
  } catch (err) {
    console.error('❌ Redis connection failed:', err);
    process.exit(1); // stop app if Redis fails
  }
};
