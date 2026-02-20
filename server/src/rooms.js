import prisma from './utils/prisma.js';

export const createRoom = async (roomId) => {
    try {
        const existingRoom = await prisma.room.findUnique({ where: { id: roomId } });
        if (!existingRoom) {
            await prisma.room.create({
                data: {
                    id: roomId,
                    isPlaying: false,
                    currentTime: 0,
                    playbackRate: 1,
                    videoUrl: null,
                },
            });
            console.log(`Room created: ${roomId}`);
        }
    } catch (error) {
        console.error('Error creating room:', error);
    }
};

export const joinRoom = async (roomId, user) => {
    try {
        await createRoom(roomId); // Ensure room exists

        // Upsert user (update if exists, create if not)
        const dbUser = await prisma.user.upsert({
            where: { id: user.id },
            update: { name: user.name, roomId },
            create: {
                id: user.id,
                name: user.name,
                roomId,
            },
        });

        console.log(`User ${user.id} joined room ${roomId}`);

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { users: true },
        });

        return {
            users: room.users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}),
            playbackState: {
                playing: room.isPlaying,
                currentTime: room.currentTime,
                playbackRate: room.playbackRate,
                videoUrl: room.videoUrl,
                lastUpdated: room.lastUpdated.getTime(),
            },
        };
    } catch (error) {
        console.error('Error joining room:', error);
        return null;
    }
};

export const leaveRoom = async (roomId, userId) => {
    try {
        await prisma.user.delete({ where: { id: userId } });
        console.log(`User ${userId} left room ${roomId}`);

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { users: true },
        });

        if (room && room.users.length === 0) {
            await prisma.room.delete({ where: { id: roomId } });
            console.log(`Room deleted: ${roomId}`);
        }
    } catch (error) {
        console.error('Error leaving room:', error);
    }
};

export const updatePlaybackState = async (roomId, state) => {
    try {
        const updatedRoom = await prisma.room.update({
            where: { id: roomId },
            data: {
                isPlaying: state.playing,
                currentTime: state.currentTime,
                playbackRate: state.playbackRate,
                videoUrl: state.videoUrl,
                lastUpdated: new Date(),
            },
        });

        return {
            playing: updatedRoom.isPlaying,
            currentTime: updatedRoom.currentTime,
            playbackRate: updatedRoom.playbackRate,
            videoUrl: updatedRoom.videoUrl,
            lastUpdated: updatedRoom.lastUpdated.getTime(),
        };
    } catch (error) {
        console.error('Error updating playback state:', error);
        return null;
    }
};
