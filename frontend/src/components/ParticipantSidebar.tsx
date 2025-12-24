'use client';

import { useTracks, useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { useState, useMemo, useEffect, useRef } from 'react';

interface ParticipantSidebarProps {
    maxVisible?: number;
}

export default function ParticipantSidebar({ maxVisible = 4 }: ParticipantSidebarProps) {
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();
    const [startIndex, setStartIndex] = useState(0);

    // 참가자 트랙 가져오기
    const tracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: true }],
        { onlySubscribed: false }
    );

    // 나(본인)를 첫 번째로, 나머지 참가자들 정렬
    const sortedParticipants = useMemo(() => {
        const others = participants.filter(p => p.identity !== localParticipant?.identity);
        if (localParticipant) {
            return [localParticipant, ...others];
        }
        return others;
    }, [participants, localParticipant]);

    // 현재 보이는 참가자들
    const visibleParticipants = useMemo(() => {
        return sortedParticipants.slice(startIndex, startIndex + maxVisible);
    }, [sortedParticipants, startIndex, maxVisible]);

    // 화살표 표시 여부
    const showUpArrow = startIndex > 0;
    const showDownArrow = startIndex + maxVisible < sortedParticipants.length;
    const totalParticipants = sortedParticipants.length;

    const handleUp = () => {
        setStartIndex(Math.max(0, startIndex - 1));
    };

    const handleDown = () => {
        setStartIndex(Math.min(totalParticipants - maxVisible, startIndex + 1));
    };

    // 참가자 트랙 찾기
    const getTrackForParticipant = (participant: Participant) => {
        return tracks.find(t => t.participant.identity === participant.identity);
    };

    return (
        <div className="flex flex-col h-full w-32 bg-gray-800/50 backdrop-blur-sm border-l border-gray-700/50">
            {/* 위 화살표 */}
            <button
                onClick={handleUp}
                disabled={!showUpArrow}
                className={`flex-shrink-0 h-8 flex items-center justify-center transition-colors ${showUpArrow
                        ? 'text-white hover:bg-gray-700/50 cursor-pointer'
                        : 'text-gray-600 cursor-not-allowed'
                    }`}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
            </button>

            {/* 참가자 목록 */}
            <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
                {visibleParticipants.map((participant, index) => {
                    const trackRef = getTrackForParticipant(participant);
                    const isLocal = participant.identity === localParticipant?.identity;
                    const videoTrack = trackRef?.publication?.track;

                    return (
                        <div
                            key={participant.identity}
                            className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden ring-1 ring-white/10"
                        >
                            {/* 비디오 */}
                            {videoTrack ? (
                                <VideoRenderer track={videoTrack} />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {participant.identity.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                            )}

                            {/* 이름 라벨 */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                                <p className="text-white text-[10px] truncate text-center">
                                    {isLocal ? '나' : participant.identity}
                                </p>
                            </div>

                            {/* 음소거 표시 */}
                            {participant.isMicrophoneEnabled === false && (
                                <div className="absolute top-1 right-1 bg-red-500/80 rounded-full p-0.5">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 아래 화살표 */}
            <button
                onClick={handleDown}
                disabled={!showDownArrow}
                className={`flex-shrink-0 h-8 flex items-center justify-center transition-colors ${showDownArrow
                        ? 'text-white hover:bg-gray-700/50 cursor-pointer'
                        : 'text-gray-600 cursor-not-allowed'
                    }`}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* 참가자 수 표시 */}
            <div className="flex-shrink-0 p-2 text-center border-t border-gray-700/50">
                <span className="text-gray-400 text-xs">{totalParticipants}명</span>
            </div>
        </div>
    );
}

// 비디오 렌더러 컴포넌트
function VideoRenderer({ track }: { track: any }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && track) {
            track.attach(videoRef.current);
            return () => {
                track.detach(videoRef.current!);
            };
        }
    }, [track]);

    return (
        <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
        />
    );
}
