// Simple In-Memory Store for Whiteboard History
// In production, replace this with Redis.

// Key: RoomID, Value: Array of Stroke Events
const globalWhiteboardStore = global as unknown as {
    whiteboardData: Map<string, any[]>
};

if (!globalWhiteboardStore.whiteboardData) {
    globalWhiteboardStore.whiteboardData = new Map();
}

export const WhiteboardStore = {
    getHistory: (roomId: string) => {
        return globalWhiteboardStore.whiteboardData.get(roomId) || [];
    },

    addStroke: (roomId: string, stroke: any[]) => {
        const current = globalWhiteboardStore.whiteboardData.get(roomId) || [];
        // Limit history size to prevent memory leaks in this demo
        if (current.length > 10000) {
            current.shift(); // Remove oldest
        }
        current.push(stroke);
        globalWhiteboardStore.whiteboardData.set(roomId, current);
    },

    clear: (roomId: string) => {
        globalWhiteboardStore.whiteboardData.delete(roomId);
    }
};
