import { NextRequest, NextResponse } from 'next/server';
import { getChatMessages, addChatMessage } from '@/lib/redis';

// GET: Retrieve chat messages for a room
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');

        if (!roomId) {
            return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
        }

        const messages = await getChatMessages(roomId);
        return NextResponse.json({ messages });
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

// POST: Add a new chat message
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roomId, message } = body;

        if (!roomId || !message) {
            return NextResponse.json({ error: 'roomId and message are required' }, { status: 400 });
        }

        await addChatMessage(roomId, message);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving chat message:', error);
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }
}
