export const handleSignaling = (io, socket) => {
    socket.on('signal', ({ to, signal }) => {
        console.log(`[Signaling] Relaying ${signal.type} from ${socket.id} to ${to}`);
        io.to(to).emit('signal', {
            from: socket.id,
            signal,
        });
    });

    socket.on('join-call', ({ roomId }) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
            const usersInRoom = Array.from(room).filter(id => id !== socket.id);
            console.log(`[Signaling] User ${socket.id} joining call in room ${roomId}. Existing users: [${usersInRoom.join(', ')}]`);

            // Notify ALL other users in the room that a new peer has joined
            // Each existing user will initiate a peer connection to the new user
            for (const userId of usersInRoom) {
                console.log(`[Signaling] Notifying ${userId} about new user ${socket.id}`);
                io.to(userId).emit('user-connected', socket.id);
            }
        } else {
            console.log(`[Signaling] User ${socket.id} joined call in room ${roomId} (room is empty or not found, no one to notify)`);
        }
    });
};
