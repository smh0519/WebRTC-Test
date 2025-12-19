# Video Call Application

WebRTC SFU 방식을 사용한 실시간 다자간 영상통화 애플리케이션입니다.

## 기술 스택

- **Frontend**: Next.js, TypeScript, TailwindCSS, livekit-client
- **Backend**: Go Fiber, LiveKit Server SDK
- **Media Server**: LiveKit (SFU)

## 아키텍처

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│   LiveKit    │
│  (Next.js)   │     │  (Go Fiber)  │     │   Server     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       └─────────── WebRTC/WebSocket ────────────┘
```

## 시작하기

### 1. LiveKit 서버 실행 (Docker)

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server \
  --dev \
  --bind 0.0.0.0
```

### 2. 백엔드 서버 실행

```bash
cd backend
go run main.go
```

백엔드 서버가 `http://localhost:8080`에서 실행됩니다.

### 3. 프론트엔드 실행

```bash
cd frontend
npm run dev
```

프론트엔드가 `http://localhost:3000`에서 실행됩니다.

## 사용 방법

1. 브라우저에서 `http://localhost:3000` 접속
2. 닉네임과 방 이름 입력
3. "방에 입장하기" 클릭
4. 카메라/마이크 권한 허용
5. 다른 브라우저 탭에서 같은 방 이름으로 입장하여 다자간 통화 테스트

## 폴더 구조

```
.
├── backend/
│   ├── main.go              # 서버 엔트리포인트
│   ├── config/
│   │   └── config.go        # 환경 설정
│   ├── handlers/
│   │   └── room.go          # 방 관련 API 핸들러
│   └── .env                  # 환경 변수
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # 메인 페이지
│   │   │   └── room/[roomId]/
│   │   │       └── page.tsx # 영상통화 방 페이지
│   │   ├── components/
│   │   │   ├── JoinRoomForm.tsx     # 방 입장 폼
│   │   │   ├── VideoRoom.tsx        # 영상통화 룸
│   │   │   ├── ParticipantTile.tsx  # 참가자 타일
│   │   │   └── ControlBar.tsx       # 미디어 컨트롤
│   │   └── lib/
│   │       └── api.ts       # API 유틸리티
│   └── .env.local           # 환경 변수
│
└── docker-compose.yml       # Docker Compose 설정
```

## 환경 변수

### Backend (.env)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| LIVEKIT_HOST | ws://localhost:7880 | LiveKit 서버 URL |
| LIVEKIT_API_KEY | devkey | LiveKit API 키 |
| LIVEKIT_API_SECRET | secret | LiveKit API 시크릿 |
| PORT | 8080 | 서버 포트 |

### Frontend (.env.local)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| NEXT_PUBLIC_API_URL | http://localhost:8080 | 백엔드 API URL |
| NEXT_PUBLIC_LIVEKIT_URL | ws://localhost:7880 | LiveKit 서버 URL |
