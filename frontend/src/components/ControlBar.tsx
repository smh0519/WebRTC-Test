'use client';

interface ControlBarProps {
    isMicEnabled: boolean;
    isCameraEnabled: boolean;
    isScreenShareEnabled: boolean;
    onToggleMic: () => void;
    onToggleCamera: () => void;
    onToggleScreenShare: () => void;
    onLeave: () => void;
}

export default function ControlBar({
    isMicEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    onToggleMic,
    onToggleCamera,
    onToggleScreenShare,
    onLeave,
}: ControlBarProps) {
    return (
        <div className="flex items-center justify-center gap-3 p-4 bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-white/10">
            {/* Microphone Toggle */}
            <button
                onClick={onToggleMic}
                className={`p-4 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${isMicEnabled
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                title={isMicEnabled ? '마이크 끄기' : '마이크 켜기'}
            >
                {isMicEnabled ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                )}
            </button>

            {/* Camera Toggle */}
            <button
                onClick={onToggleCamera}
                className={`p-4 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${isCameraEnabled
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                title={isCameraEnabled ? '카메라 끄기' : '카메라 켜기'}
            >
                {isCameraEnabled ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                )}
            </button>

            {/* Screen Share Toggle */}
            <button
                onClick={onToggleScreenShare}
                className={`p-4 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${isScreenShareEnabled
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                title={isScreenShareEnabled ? '화면 공유 중지' : '화면 공유'}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            </button>

            {/* Leave Button */}
            <button
                onClick={onLeave}
                className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ml-4"
                title="나가기"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </button>
        </div>
    );
}
