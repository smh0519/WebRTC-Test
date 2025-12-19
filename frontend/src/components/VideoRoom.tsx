'use client';

import { useEffect, useState, useCallback } from 'react';
import { Room, RoomEvent, Participant, ConnectionState, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { getToken } from '@/lib/api';
import ParticipantTile from './ParticipantTile';
import ControlBar from './ControlBar';

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

interface VideoRoomProps {
    roomName: string;
    participantName: string;
    onLeave: () => void;
}

export default function VideoRoom({ roomName, participantName, onLeave }: VideoRoomProps) {
    const [room, setRoom] = useState<Room | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
    const [error, setError] = useState<string | null>(null);
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);

    const updateParticipants = useCallback((room: Room) => {
        const allParticipants: Participant[] = [
            room.localParticipant,
            ...Array.from(room.remoteParticipants.values()),
        ];
        setParticipants(allParticipants);
    }, []);

    useEffect(() => {
        const newRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: { width: 1280, height: 720 },
            },
        });

        const connectToRoom = async () => {
            try {
                setConnectionState(ConnectionState.Connecting);

                // Get token from backend
                const token = await getToken(roomName, participantName);

                // Connect to room with custom RTC config
                await newRoom.connect(LIVEKIT_URL, token, {
                    rtcConfig: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                        ],
                    },
                    peerConnectionTimeout: 45000,
                });

                // Enable camera and microphone
                await newRoom.localParticipant.enableCameraAndMicrophone();

                setRoom(newRoom);
                setConnectionState(ConnectionState.Connected);
                updateParticipants(newRoom);
            } catch (err) {
                console.error('Failed to connect:', err);
                setError(err instanceof Error ? err.message : 'Failed to connect to room');
                setConnectionState(ConnectionState.Disconnected);
            }
        };

        // Room event handlers
        newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            setConnectionState(state);
        });

        newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log('Participant connected:', participant.identity);
            updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            console.log('Participant disconnected:', participant.identity);
            updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.TrackSubscribed, () => {
            updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, () => {
            updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.LocalTrackPublished, () => {
            updateParticipants(newRoom);
        });

        newRoom.on(RoomEvent.Disconnected, () => {
            setConnectionState(ConnectionState.Disconnected);
        });

        connectToRoom();

        return () => {
            newRoom.disconnect();
        };
    }, [roomName, participantName, updateParticipants]);

    const handleToggleMic = async () => {
        if (!room) return;

        const enabled = room.localParticipant.isMicrophoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(!enabled);
        setIsMicEnabled(!enabled);
    };

    const handleToggleCamera = async () => {
        if (!room) return;

        const enabled = room.localParticipant.isCameraEnabled;
        await room.localParticipant.setCameraEnabled(!enabled);
        setIsCameraEnabled(!enabled);
    };

    const handleToggleScreenShare = async () => {
        if (!room) return;

        try {
            const enabled = room.localParticipant.isScreenShareEnabled;
            await room.localParticipant.setScreenShareEnabled(!enabled);
            setIsScreenShareEnabled(!enabled);
        } catch (err) {
            console.error('Screen share error:', err);
        }
    };

    const handleLeave = () => {
        if (room) {
            room.disconnect();
        }
        onLeave();
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">연결 실패</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={onLeave}
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                    >
                        돌아가기
                    </button>
                </div>
            </div>
        );
    }

    if (connectionState === ConnectionState.Connecting) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">방에 연결 중...</p>
                    <p className="text-gray-400 mt-2">{roomName}</p>
                </div>
            </div>
        );
    }

    // Calculate grid layout based on participant count
    const getGridClass = () => {
        const count = participants.length;
        if (count === 1) return 'grid-cols-1 max-w-2xl';
        if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-4xl';
        if (count <= 4) return 'grid-cols-2 max-w-5xl';
        if (count <= 6) return 'grid-cols-2 md:grid-cols-3 max-w-6xl';
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl';
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <h1 className="text-white font-semibold">{roomName}</h1>
                </div>
                <div className="text-gray-400 text-sm">
                    {participants.length}명 참가 중
                </div>
            </header>

            {/* Video Grid */}
            <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
                <div className={`w-full ${getGridClass()} mx-auto grid gap-4`}>
                    {participants.map((participant) => (
                        <ParticipantTile
                            key={participant.sid}
                            participant={participant}
                            isLocal={participant instanceof LocalParticipant}
                        />
                    ))}
                </div>
            </main>

            {/* Control Bar */}
            <footer className="p-4 flex justify-center">
                <ControlBar
                    isMicEnabled={isMicEnabled}
                    isCameraEnabled={isCameraEnabled}
                    isScreenShareEnabled={isScreenShareEnabled}
                    onToggleMic={handleToggleMic}
                    onToggleCamera={handleToggleCamera}
                    onToggleScreenShare={handleToggleScreenShare}
                    onLeave={handleLeave}
                />
            </footer>
        </div>
    );
}
