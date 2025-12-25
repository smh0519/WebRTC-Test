import { getRedisClient } from './redis';

// Get Redis client
const redis = getRedisClient();

// Redis Keys helper
const getKey = (roomId: string) => `whiteboard:room:${roomId}`;
const getRedoKey = (roomId: string) => `whiteboard:redo:${roomId}`;

export const WhiteboardStore = {
    getHistory: async (roomId: string): Promise<any[]> => {
        const data = await redis.get(getKey(roomId));
        return data ? JSON.parse(data) : [];
    },

    addStroke: async (roomId: string, stroke: any[]) => {
        const key = getKey(roomId);
        const redoKey = getRedoKey(roomId);

        // Fetch current history
        const data = await redis.get(key);
        const history: any[] = data ? JSON.parse(data) : [];

        // Limit history size (optional, keep 2000 strokes)
        if (history.length > 2000) {
            history.shift();
        }
        history.push(stroke);

        // Save updated history and clear redo stack
        await Promise.all([
            redis.set(key, JSON.stringify(history)),
            redis.del(redoKey)
        ]);
    },

    undo: async (roomId: string): Promise<any[]> => {
        const key = getKey(roomId);
        const redoKey = getRedoKey(roomId);

        const [historyData, redoData] = await Promise.all([
            redis.get(key),
            redis.get(redoKey)
        ]);

        const history: any[] = historyData ? JSON.parse(historyData) : [];
        const redo: any[] = redoData ? JSON.parse(redoData) : [];

        if (history.length > 0) {
            const lastStroke = history.pop();
            redo.push(lastStroke);

            await Promise.all([
                redis.set(key, JSON.stringify(history)),
                redis.set(redoKey, JSON.stringify(redo))
            ]);
        }
        return history;
    },

    redo: async (roomId: string): Promise<any[]> => {
        const key = getKey(roomId);
        const redoKey = getRedoKey(roomId);

        const [historyData, redoData] = await Promise.all([
            redis.get(key),
            redis.get(redoKey)
        ]);

        const history: any[] = historyData ? JSON.parse(historyData) : [];
        const redo: any[] = redoData ? JSON.parse(redoData) : [];

        if (redo.length > 0) {
            const strokeToRedo = redo.pop();
            history.push(strokeToRedo);

            await Promise.all([
                redis.set(key, JSON.stringify(history)),
                redis.set(redoKey, JSON.stringify(redo))
            ]);
        }
        return history;
    },

    getRedoSize: async (roomId: string): Promise<number> => {
        const data = await redis.get(getRedoKey(roomId));
        const redo: any[] = data ? JSON.parse(data) : [];
        return redo.length;
    },

    clear: async (roomId: string) => {
        const key = getKey(roomId);
        const redoKey = getRedoKey(roomId);
        await Promise.all([
            redis.del(key),
            redis.del(redoKey)
        ]);
    }
};
