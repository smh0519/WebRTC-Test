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
import WhiteboardCanvas from '@/components/WhiteboardCanvas';
import ParticipantSidebar from '@/components/ParticipantSidebar';

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

function RoomContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [token, setToken] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);

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
                disconnectOnPageLeave: true,
                // 카메라 설정
                videoCaptureDefaults: {
                    resolution: { width: 1280, height: 720, frameRate: 30 },
                },
                // 퍼블리시 최적화 설정
                publishDefaults: {
                    simulcast: true,
                    videoCodec: 'vp8',
                    // 화면 공유 최적화
                    screenShareEncoding: {
                        maxBitrate: 3_000_000,
                        maxFramerate: 15,
                    },
                },
            }}
            className="h-screen w-screen bg-gray-900 overflow-hidden relative"
            style={{ height: '100vh' }}
        >
            {/* Main Content Area */}
            <div className="absolute inset-0 w-full h-full z-0 flex flex-col">
                <CustomVideoConference />
                <RoomAudioRenderer />
            </div>

            {/* Whiteboard Mode - Split Layout */}
            {isWhiteboardOpen && (
                <div className="absolute inset-0 z-50 flex overflow-hidden animate-in fade-in duration-200">
                    {/* 화이트보드 영역 (왼쪽 - 넓게) */}
                    <div className="flex-1 flex flex-col bg-gray-800">
                        {/* 헤더 */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-900/50 border-b border-gray-700/50">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span className="text-white font-semibold">화이트보드</span>
                            </div>
                            <button
                                onClick={() => setIsWhiteboardOpen(false)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                닫기
                            </button>
                        </div>
                        {/* 캔버스 */}
                        <div className="flex-1 relative">
                            <WhiteboardCanvas />
                        </div>
                    </div>

                    {/* 참가자 사이드바 (오른쪽 - 좁게) */}
                    <ParticipantSidebar maxVisible={4} />
                </div>
            )}

            {/* Floating Toggle Button */}
            {!isWhiteboardOpen && (
                <div className="absolute bottom-8 right-8 z-40">
                    <button
                        onClick={() => setIsWhiteboardOpen(true)}
                        className="bg-white text-gray-900 p-4 rounded-full shadow-xl hover:bg-gray-100 transition-transform hover:scale-105 flex items-center gap-2 group"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span className="font-bold hidden group-hover:block transition-all">화이트보드 열기</span>
                    </button>
                </div>
            )}
        </LiveKitRoom>
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
