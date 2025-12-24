const API_BASE_URL = ''; // Relative path for Next.js API Routes

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
    let errorMessage = 'Failed to get token';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = `Server Error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const data: TokenResponse = await response.json();
  return data.token;
}
