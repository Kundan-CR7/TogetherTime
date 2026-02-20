import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRoom, joinRoom, leaveRoom, updatePlaybackState } from './rooms.js';
import { handleSignaling } from './signaling.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: [
            "https://together-time-amber.vercel.app",
            "http://localhost:5173",
            process.env.CLIENT_URL
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true
    },
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('TogetherTime Signaling Server is running');
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Room Management
    socket.on('join-room', async ({ roomId, userName }) => {
        socket.join(roomId);
        const roomState = await joinRoom(roomId, { id: socket.id, name: userName });

        if (roomState) {
            // Send current room state to the joining user
            socket.emit('room-state', roomState);

            // Notify others
            socket.to(roomId).emit('user-joined', { id: socket.id, name: userName });
        }
    });

    socket.on('leave-room', async ({ roomId }) => {
        await leaveRoom(roomId, socket.id);
        socket.leave(roomId);
        socket.to(roomId).emit('user-left', socket.id);
    });

    socket.on('disconnecting', () => {
        const rooms = Array.from(socket.rooms);
        rooms.forEach(async (roomId) => {
            if (roomId !== socket.id) {
                await leaveRoom(roomId, socket.id);
                socket.to(roomId).emit('user-left', socket.id);
            }
        });
    });

    // Playback Sync
    socket.on('playback-update', async ({ roomId, state }) => {
        // state: { playing, currentTime, playbackRate, videoUrl }
        const updatedState = await updatePlaybackState(roomId, state);
        if (updatedState) {
            // Broadcast to everyone in the room EXCEPT the sender
            socket.to(roomId).emit('playback-update', {
                ...updatedState,
                senderId: socket.id, // Client can use this to ignore own updates if needed
            });
        }
    });

    socket.on('request-play', ({ roomId, currentTime }) => {
        // Schedule play 1 second in the future
        const playAt = Date.now() + 1000;
        io.in(roomId).emit('play-at', { playAt, currentTime });

        // Also update state to playing
        updatePlaybackState(roomId, { playing: true, currentTime, playbackRate: 1 });
    });

    socket.on('change-video', async ({ roomId, videoUrl }) => {
        const updatedState = await updatePlaybackState(roomId, {
            playing: false,
            currentTime: 0,
            playbackRate: 1,
            videoUrl
        });
        io.in(roomId).emit('playback-update', {
            ...updatedState,
            senderId: socket.id
        });
    });

    // WebRTC Signaling
    handleSignaling(io, socket);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
