# TogetherTime (Watch Party)

A real-time synced video playback platform where users can watch local video files together in perfect sync while video calling.

## Features
- **Synced Playback**: Play, pause, seek, and playback rate are synchronized across all users.
- **Local File Support**: Users upload their own copy of the video file (no server bandwidth costs).
- **Video/Audio Call**: Built-in WebRTC video chat.
- **Room System**: Create or join private rooms via ID.
- **Drift Correction**: Automatic sync adjustment if a user falls behind.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Socket.io Client
- **Backend**: Node.js, Express, Socket.io
- **Signaling**: WebRTC for peer-to-peer media

## Prerequisites
- Node.js (v16+)
- npm

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd TogetherTime
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Install Client Dependencies
```bash
cd ../client
npm install
```

## Running the App

### 1. Start the Server
```bash
cd server
npm run dev
```
Server runs on `http://localhost:3001`.

### 2. Start the Client
```bash
cd client
npm run dev
```
Client runs on `http://localhost:5173`.

## Usage
1. Open the client URL in your browser.
2. Enter your name and click "Create Room".
3. Copy the Room ID and share it with a friend.
4. Both users must select the **same video file** from their computer.
5. Play the video! Actions are synced instantly.

## Architecture
See [Architecture Overview](docs/architecture.md) for details.
