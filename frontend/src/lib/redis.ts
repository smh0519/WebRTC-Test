import Redis from 'ioredis';

// Singleton Redis client
let redis: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redis) {
        const redisUrl = process.env.REDIS_URL;

        if (!redisUrl) {
            throw new Error('REDIS_URL environment variable is not set');
        }

        redis = new Redis(redisUrl, {
            tls: {
                rejectUnauthorized: false, // For AWS ElastiCache Serverless
            },
            maxRetriesPerRequest: 3,
        });

        redis.on('error', (err) => {
            console.error('Redis connection error:', err);
        });

        redis.on('connect', () => {
            console.log('Redis connected successfully');
        });
    }

    return redis;
}

// Helper functions for chat messages
export async function getChatMessages(roomId: string): Promise<any[]> {
    const client = getRedisClient();
    const messages = await client.lrange(`chat:${roomId}`, 0, -1);
    return messages.map((msg) => JSON.parse(msg));
}

export async function addChatMessage(roomId: string, message: any): Promise<void> {
    const client = getRedisClient();
    await client.rpush(`chat:${roomId}`, JSON.stringify(message));
    // Set TTL to 24 hours (auto-cleanup)
    await client.expire(`chat:${roomId}`, 86400);
}

// Helper functions for whiteboard data
export async function getWhiteboardData(roomId: string): Promise<any[]> {
    const client = getRedisClient();
    const data = await client.lrange(`whiteboard:${roomId}`, 0, -1);
    return data.map((d) => JSON.parse(d));
}

export async function addWhiteboardEvent(roomId: string, event: any): Promise<void> {
    const client = getRedisClient();
    await client.rpush(`whiteboard:${roomId}`, JSON.stringify(event));
    await client.expire(`whiteboard:${roomId}`, 86400);
}

export async function clearWhiteboard(roomId: string): Promise<void> {
    const client = getRedisClient();
    await client.del(`whiteboard:${roomId}`);
}
