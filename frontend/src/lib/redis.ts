import Redis from 'ioredis';

// Redis configuration based on user request
const REDIS_HOST = 'eum-redis-cache-j0kfyk.serverless.apn2.cache.amazonaws.com';
const REDIS_PORT = 6379;

// In a real production app, checking for existing instance in global scope 
// prevents multiple connections in dev mode (Next.js hot reload).
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
    globalForRedis.redis ||
    new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        connectTimeout: 10000, // 10s timeout
        lazyConnect: true, // Don't connect immediately on import
    });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
