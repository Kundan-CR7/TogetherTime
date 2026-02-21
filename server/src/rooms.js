// In-memory store for rooms and users
const rooms = new Map();

export const createRoom = (roomId) => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            id: roomId,
            isPlaying: false,
            currentTime: 0,
            playbackRate: 1,
            videoUrl: null,
            lastUpdated: Date.now(),
            users: {} // Map of userId -> userObj
        });
        console.log(`Room created: ${roomId}`);
    }
};

export const joinRoom = (roomId, user) => {
    createRoom(roomId); // Ensure room exists

    const room = rooms.get(roomId);

    // Upsert user
    room.users[user.id] = {
        id: user.id,
        name: user.name,
        roomId,
        joinedAt: Date.now()
    };

    console.log(`User ${user.id} (${user.name}) joined room ${roomId}`);

    return {
        users: room.users,
        playbackState: {
            playing: room.isPlaying,
            currentTime: room.currentTime,
            playbackRate: room.playbackRate,
            videoUrl: room.videoUrl,
            lastUpdated: room.lastUpdated,
        },
    };
};

export const leaveRoom = (roomId, userId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.users[userId]) {
        console.log(`User ${userId} left room ${roomId}`);
        delete room.users[userId];
    }

    if (Object.keys(room.users).length === 0) {
        rooms.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
    }
};

export const updatePlaybackState = (roomId, state) => {
    const room = rooms.get(roomId);
    if (!room) return null;

    room.isPlaying = state.playing !== undefined ? state.playing : room.isPlaying;
    room.currentTime = state.currentTime !== undefined ? state.currentTime : room.currentTime;
    room.playbackRate = state.playbackRate !== undefined ? state.playbackRate : room.playbackRate;
    room.videoUrl = state.videoUrl !== undefined ? state.videoUrl : room.videoUrl;
    room.lastUpdated = Date.now();

    return {
        playing: room.isPlaying,
        currentTime: room.currentTime,
        playbackRate: room.playbackRate,
        videoUrl: room.videoUrl,
        lastUpdated: room.lastUpdated,
    };
};
