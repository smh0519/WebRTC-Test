import { NextRequest, NextResponse } from 'next/server';
import { WhiteboardStore } from '@/lib/whiteboard-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get('room');

    if (!room) {
        return NextResponse.json({ error: 'Room required' }, { status: 400 });
    }

    const history = WhiteboardStore.getHistory(room);
    return NextResponse.json(history);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { room, stroke, type } = body;

        if (!room) {
            return NextResponse.json({ error: 'Room required' }, { status: 400 });
        }

        if (type === 'clear') {
            WhiteboardStore.clear(room);
            return NextResponse.json({ success: true });
        }

        if (stroke && Array.isArray(stroke)) {
            // Save the stroke (vector array)
            WhiteboardStore.addStroke(room, stroke);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    } catch (e) {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
