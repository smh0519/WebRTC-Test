import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { roomName, participantName } = await req.json();

    if (!roomName || !participantName) {
        return NextResponse.json(
            { error: 'Missing roomName or participantName' },
            { status: 400 }
        );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    console.log('Checking Env Vars:', {
        url: wsUrl,
        hasKey: !!apiKey,
        hasSecret: !!apiSecret
    });

    if (!apiKey || !apiSecret || !wsUrl) {
        console.error('Missing Environment Variables');
        return NextResponse.json(
            { error: 'Server misconfigured' },
            { status: 500 }
        );
    }

    const at = new AccessToken(apiKey, apiSecret, {
        identity: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName });

    try {
        const token = await at.toJwt();
        return NextResponse.json({ token });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: 'Could not generate token' },
            { status: 500 }
        );
    }
}
