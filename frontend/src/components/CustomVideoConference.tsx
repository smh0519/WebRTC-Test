'use client';

import {
    GridLayout,
    ParticipantTile,
    useTracks,
    useParticipants,
    TrackRefContext,
    ControlBar,
    RoomName,
    ConnectionState,
    useConnectionState,
    CarouselLayout,
    FocusLayout,
    FocusLayoutContainer,
} from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { useMemo } from 'react';

export default function CustomVideoConference() {
    const connectionState = useConnectionState();
    const participants = useParticipants();

    // 비디오 또는 오디오 트랙이 있는 참가자만 필터링
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        {
            onlySubscribed: false,
        }
    );

    // 실제로 트랙을 publish한 참가자만 필터링
    const activeTracks = useMemo(() => {
        return tracks.filter((trackRef) => {
            // 트랙이 있거나, participant가 카메라/마이크를 publish 중인 경우만 표시
            const participant = trackRef.participant;
            const hasPublishedTrack =
                participant.videoTrackPublications.size > 0 ||
                participant.audioTrackPublications.size > 0;

            return hasPublishedTrack;
        });
    }, [tracks]);

    // 연결 중일 때
    if (connectionState === 'connecting') {
        return (
            <div className="h-full flex items-center justify-center bg-gray-900">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white text-lg">연결 중...</p>
                </div>
            </div>
        );
    }

    // 활성 참가자가 없을 때
    if (activeTracks.length === 0) {
        return (
            <div className="h-full flex flex-col bg-gray-900">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <RoomName className="text-white font-semibold" />
                    </div>
                    <span className="text-gray-400 text-sm">
                        {participants.length}명 참가 중
                    </span>
                </div>

                {/* 대기 화면 */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-gray-400 text-lg">카메라/마이크를 켜주세요</p>
                        <p className="text-gray-500 text-sm mt-2">다른 참가자가 권한을 설정 중일 수 있습니다</p>
                    </div>
                </div>

                {/* 컨트롤 바 */}
                <div className="p-4">
                    <ControlBar variation="minimal" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-900">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <RoomName className="text-white font-semibold" />
                </div>
                <span className="text-gray-400 text-sm">
                    {activeTracks.length}명 화면 공유 중
                </span>
            </div>

            {/* 비디오 그리드 */}
            <div className="flex-1 p-4">
                <GridLayout
                    tracks={activeTracks}
                    style={{ height: '100%' }}
                >
                    <ParticipantTile />
                </GridLayout>
            </div>

            {/* 컨트롤 바 */}
            <div className="p-4">
                <ControlBar variation="minimal" />
            </div>
        </div>
    );
}
