import { NextRequest, NextResponse } from 'next/server';
import { WhiteboardStore } from '@/lib/whiteboard-store';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get('room');

    if (!room) {
        return NextResponse.json({ error: 'Room required' }, { status: 400 });
    }

    const history = await WhiteboardStore.getHistory(room);
    const redoCount = await WhiteboardStore.getRedoSize(room);

    return NextResponse.json({
        history,
        canUndo: history.length > 0,
        canRedo: redoCount > 0
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { room, stroke, type } = body;

        if (!room) {
            return NextResponse.json({ error: 'Room required' }, { status: 400 });
        }

        if (type === 'clear') {
            await WhiteboardStore.clear(room);
            return NextResponse.json({ success: true, canUndo: false, canRedo: false });
        }

        if (type === 'undo') {
            const history = await WhiteboardStore.undo(room);
            const redoCount = await WhiteboardStore.getRedoSize(room);
            return NextResponse.json({
                success: true,
                history,
                canUndo: history.length > 0,
                canRedo: redoCount > 0
            });
        }

        if (type === 'redo') {
            const history = await WhiteboardStore.redo(room);
            const redoCount = await WhiteboardStore.getRedoSize(room);
            return NextResponse.json({
                success: true,
                history,
                canUndo: history.length > 0,
                canRedo: redoCount > 0
            });
        }

        if (stroke && Array.isArray(stroke)) {
            // Save the stroke (vector array)
            await WhiteboardStore.addStroke(room, stroke);
            // After adding, we can undo (at least 1) and cannot redo (stack cleared)
            return NextResponse.json({
                success: true,
                canUndo: true,
                canRedo: false
            });
        }

        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    } catch (e) {
        console.error("API Error", e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
