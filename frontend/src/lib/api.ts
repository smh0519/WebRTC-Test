const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface TokenResponse {
  token: string;
}

export async function getToken(roomName: string, participantName: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomName,
      participantName,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get token');
  }

  const data: TokenResponse = await response.json();
  return data.token;
}
