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
import ChatPanel from '@/components/ChatPanel';

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

function RoomContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [token, setToken] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

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

    // Force Layout Recalculation on Toggle
    useEffect(() => {
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    }, [isWhiteboardOpen]);

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
                adaptiveStream: false, // Critical: Prevents video from pausing when covered by whiteboard
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
                },
            }}
            className="h-screen w-screen bg-gray-900 overflow-hidden relative"
            style={{ height: '100vh' }}
        >
            {/* Audio Renderer - Always Active */}
            <RoomAudioRenderer />

            {/* Content Switcher: Video OR Whiteboard (Mutex) to prevent Black Screen bugs */}
            {isWhiteboardOpen ? (
                // --- Whiteboard Mode ---
                <div className="absolute inset-0 z-50 flex overflow-hidden bg-gray-900/95 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex-1 flex flex-col relative h-full rounded-2xl overflow-hidden m-4 bg-white shadow-2xl ring-1 ring-white/10">
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-900 font-bold text-lg">📝 화이트보드</span>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">실시간 저장됨</span>
                            </div>
                            <button
                                onClick={() => setIsWhiteboardOpen(false)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                        {/* Canvas */}
                        <div className="flex-1 relative">
                            <WhiteboardCanvas />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="w-80 h-full p-4 pl-0">
                        <div className="h-full bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
                            <ParticipantSidebar />
                        </div>
                    </div>
                </div>
            ) : (
                // --- Video Mode ---
                <div className="absolute inset-0 w-full h-full flex flex-col z-0 animate-in fade-in duration-300">
                    <CustomVideoConference />
                </div>
            )}

            {/* Floating Toggle Buttons */}
            {!isWhiteboardOpen && (
                <div className="absolute bottom-8 right-8 z-40 flex gap-3">
                    {/* Chat Button */}
                    <button
                        onClick={() => {
                            setIsChatOpen(!isChatOpen);
                            if (!isChatOpen) setUnreadCount(0);
                        }}
                        className={`relative p-4 rounded-full shadow-xl transition-transform hover:scale-105 flex items-center gap-2 group ${isChatOpen
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {unreadCount > 0 && !isChatOpen && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Whiteboard Button */}
                    <button
                        onClick={() => setIsWhiteboardOpen(true)}
                        className="bg-white text-gray-900 p-4 rounded-full shadow-xl hover:bg-gray-100 transition-transform hover:scale-105 flex items-center gap-2 group"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Chat Panel (Side Slide) */}
            {isChatOpen && !isWhiteboardOpen && (
                <div className="absolute top-4 right-4 bottom-4 w-80 z-50">
                    <ChatPanel
                        roomId={roomId}
                        onClose={() => setIsChatOpen(false)}
                        onNewMessage={() => {
                            if (!isChatOpen) setUnreadCount(prev => prev + 1);
                        }}
                    />
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
