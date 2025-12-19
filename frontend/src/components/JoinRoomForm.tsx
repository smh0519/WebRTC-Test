'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinRoomForm() {
    const [roomName, setRoomName] = useState('');
    const [participantName, setParticipantName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!roomName.trim() || !participantName.trim()) {
            return;
        }

        setIsLoading(true);

        // Navigate to the room with query params
        const params = new URLSearchParams({
            participant: participantName.trim(),
        });

        router.push(`/room/${encodeURIComponent(roomName.trim())}?${params.toString()}`);
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
            <div className="space-y-2">
                <label htmlFor="participantName" className="block text-sm font-medium text-gray-300">
                    닉네임
                </label>
                <input
                    type="text"
                    id="participantName"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="사용할 닉네임을 입력하세요"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    required
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="roomName" className="block text-sm font-medium text-gray-300">
                    방 이름
                </label>
                <input
                    type="text"
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="입장할 방 이름을 입력하세요"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={isLoading || !roomName.trim() || !participantName.trim()}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        입장 중...
                    </span>
                ) : (
                    '방에 입장하기'
                )}
            </button>
        </form>
    );
}
