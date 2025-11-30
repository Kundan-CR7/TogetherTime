export const handleSignaling = (io, socket) => {
    socket.on('signal', ({ to, signal }) => {
        io.to(to).emit('signal', {
            from: socket.id,
            signal,
        });
    });

    socket.on('join-call', ({ roomId }) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
            // Notify other users in the room that a new peer has joined
            socket.to(roomId).emit('user-connected', socket.id);
        }
    });
};
