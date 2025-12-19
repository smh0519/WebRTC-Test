'use client';

import { useEffect, useRef, useState } from 'react';
import { Track, Participant, RemoteTrack, RemoteTrackPublication, TrackPublication } from 'livekit-client';

interface ParticipantTileProps {
    participant: Participant;
    isLocal?: boolean;
}

export default function ParticipantTile({ participant, isLocal = false }: ParticipantTileProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(true);

    useEffect(() => {
        const handleTrackSubscribed = (track: RemoteTrack, publication: RemoteTrackPublication) => {
            if (track.kind === Track.Kind.Video && videoRef.current) {
                track.attach(videoRef.current);
                setIsVideoOff(false);
            } else if (track.kind === Track.Kind.Audio && audioRef.current && !isLocal) {
                track.attach(audioRef.current);
            }
        };

        const handleTrackUnsubscribed = (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Video) {
                track.detach();
                setIsVideoOff(true);
            } else if (track.kind === Track.Kind.Audio) {
                track.detach();
            }
        };

        const handleTrackMuted = (publication: TrackPublication) => {
            if (publication.kind === Track.Kind.Audio) {
                setIsMuted(true);
            } else if (publication.kind === Track.Kind.Video) {
                setIsVideoOff(true);
            }
        };

        const handleTrackUnmuted = (publication: TrackPublication) => {
            if (publication.kind === Track.Kind.Audio) {
                setIsMuted(false);
            } else if (publication.kind === Track.Kind.Video) {
                setIsVideoOff(false);
            }
        };

        // Attach existing tracks
        participant.trackPublications.forEach((publication) => {
            if (publication.track) {
                if (publication.track.kind === Track.Kind.Video && videoRef.current) {
                    publication.track.attach(videoRef.current);
                    setIsVideoOff(false);
                } else if (publication.track.kind === Track.Kind.Audio && audioRef.current && !isLocal) {
                    publication.track.attach(audioRef.current);
                }
            }
            if (publication.isMuted) {
                if (publication.kind === Track.Kind.Audio) setIsMuted(true);
                if (publication.kind === Track.Kind.Video) setIsVideoOff(true);
            }
        });

        // Subscribe to events
        participant.on('trackSubscribed', handleTrackSubscribed);
        participant.on('trackUnsubscribed', handleTrackUnsubscribed);
        participant.on('trackMuted', handleTrackMuted);
        participant.on('trackUnmuted', handleTrackUnmuted);

        return () => {
            participant.off('trackSubscribed', handleTrackSubscribed);
            participant.off('trackUnsubscribed', handleTrackUnsubscribed);
            participant.off('trackMuted', handleTrackMuted);
            participant.off('trackUnmuted', handleTrackUnmuted);

            // Detach all tracks
            participant.trackPublications.forEach((publication) => {
                if (publication.track) {
                    publication.track.detach();
                }
            });
        };
    }, [participant, isLocal]);

    return (
        <div className="relative aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />

            {/* Audio element for remote participants */}
            {!isLocal && <audio ref={audioRef} autoPlay />}

            {/* Placeholder when video is off */}
            {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                        {participant.identity.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}

            {/* Participant info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm truncate">
                        {participant.identity}
                        {isLocal && ' (나)'}
                    </span>

                    {/* Mute indicator */}
                    {isMuted && (
                        <span className="flex items-center justify-center w-6 h-6 bg-red-500 rounded-full">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                        </span>
                    )}
                </div>
            </div>

            {/* Local participant indicator */}
            {isLocal && (
                <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-purple-500/80 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                        나
                    </span>
                </div>
            )}
        </div>
    );
}
