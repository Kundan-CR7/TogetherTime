# Architecture Overview

## System Design
TogetherTime uses a **hybrid architecture**:
1.  **Client-Server (Star Topology)** for Control Signals:
    - Playback state (play/pause/seek) is routed through the Socket.io server.
    - Room management is handled by the server.
2.  **Peer-to-Peer (Mesh Topology)** for Media:
    - Video/Audio calls use WebRTC directly between clients.
    - No media traffic passes through the server.

## Data Flow

### 1. Room Join
- Client connects to Socket.io server.
- Emits `join-room` with Room ID.
- Server adds socket to room and broadcasts `user-joined`.

### 2. Video Sync
- **Action**: User A clicks Play.
- **Event**: Client A emits `playback-update` { playing: true, currentTime: 10.5 }.
- **Broadcast**: Server relays this to all other users in the room.
- **Reaction**: Client B receives update.
    - If `playing` state differs -> Update video element.
    - If `currentTime` drift > 0.5s -> Seek video element.

### 3. WebRTC Signaling
- **Discovery**: When User B joins, User A receives `user-joined`.
- **Offer**: User A creates `RTCPeerConnection`, creates Offer, sends via Socket.io (`signal` event).
- **Answer**: User B receives Offer, creates Answer, sends back via Socket.io.
- **ICE Candidates**: Exchanged via Socket.io as they are discovered.
- **Connection**: P2P connection established, media streams flow directly.

## Directory Structure
- `server/`: Node.js signaling server.
    - `src/rooms.js`: In-memory room state.
    - `src/signaling.js`: WebRTC signal relay.
- `client/`: React frontend.
    - `src/services/signaling.js`: Socket.io wrapper.
    - `src/services/rtc.js`: WebRTC wrapper.
    - `src/hooks/useSyncPlayer.js`: Sync logic hook.
