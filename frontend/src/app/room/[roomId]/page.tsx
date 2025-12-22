'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import {
    LiveKitRoom,
    RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { getToken } from '@/lib/api';
import CustomVideoConference from '@/components/CustomVideoConference';

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

function RoomContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [token, setToken] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const roomId = params.roomId as string;
    const participantName = searchParams.get('participant') || 'Anonymous';

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const t = await getToken(decodeURIComponent(roomId), participantName);
                setToken(t);
            } catch (err) {
                console.error('Failed to get token:', err);
                setError('토큰을 가져오는데 실패했습니다.');
            }
        };

        if (roomId && participantName) {
            fetchToken();
        }
    }, [roomId, participantName]);

    const handleLeave = () => {
        router.push('/');
    };

    if (!roomId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-white">잘못된 방 정보입니다.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center">
                    <h2 className="text-xl font-bold text-white mb-2">연결 실패</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={handleLeave}
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                    >
                        돌아가기
                    </button>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">연결 준비 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-900">
            <LiveKitRoom
                serverUrl={LIVEKIT_URL}
                token={token}
                connect={true}
                video={true}
                audio={true}
                onDisconnected={handleLeave}
                onError={(err) => {
                    console.error('LiveKit error:', err);
                    setError(err.message);
                }}
                options={{
                    adaptiveStream: true,
                    dynacast: true,
                    // 연결 안정성 향상
                    disconnectOnPageLeave: true,
                    // 비디오 기본 설정
                    videoCaptureDefaults: {
                        resolution: { width: 1280, height: 720, frameRate: 30 },
                    },
                    // 퍼블리시 기본 설정
                    publishDefaults: {
                        simulcast: true,
                        videoCodec: 'vp8',
                    },
                }}
                style={{ height: '100%' }}
            >
                <CustomVideoConference />
                <RoomAudioRenderer />
            </LiveKitRoom>
        </div>
    );
}

export default function RoomPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <RoomContent />
        </Suspense>
    );
}
