import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { socket, connectSocket, disconnectSocket } from '../services/signaling';
import { v4 as uuidv4 } from 'uuid';

const RoomContext = createContext();

export const useRoom = () => useContext(RoomContext);

export const RoomProvider = ({ children }) => {
    const [user, setUser] = useState({ id: '', name: '' });
    const [roomId, setRoomId] = useState(null);
    const [roomState, setRoomState] = useState({ users: {}, playbackState: {} });
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Initialize user ID if not present
        const storedUserId = localStorage.getItem('userId');
        const storedUserName = localStorage.getItem('userName');

        if (storedUserId) {
            setUser({ id: storedUserId, name: storedUserName || 'Guest' });
        } else {
            const newId = uuidv4();
            setUser({ id: newId, name: 'Guest' });
            localStorage.setItem('userId', newId);
        }

        // Socket listeners
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('room-state', (state) => {
            setRoomState(state);
        });

        socket.on('user-joined', (newUser) => {
            setRoomState((prev) => ({
                ...prev,
                users: { ...prev.users, [newUser.id]: newUser },
            }));
        });

        socket.on('user-left', (userId) => {
            setRoomState((prev) => {
                const newUsers = { ...prev.users };
                delete newUsers[userId];
                return { ...prev, users: newUsers };
            });
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('room-state');
            socket.off('user-joined');
            socket.off('user-left');
        };
    }, []);

    const joinRoom = useCallback((id, name) => {
        connectSocket();
        setRoomId(id);
        setUser((prev) => {
            const updated = { ...prev, name };
            localStorage.setItem('userName', name);
            return updated;
        });
        socket.emit('join-room', { roomId: id, userName: name });
    }, []);

    const leaveRoom = useCallback(() => {
        if (roomId) {
            socket.emit('leave-room', { roomId });
            setRoomId(null);
            setRoomState({ users: {}, playbackState: {} });
            disconnectSocket();
        }
    }, [roomId]);

    return (
        <RoomContext.Provider value={{
            user,
            roomId,
            roomState,
            isConnected,
            joinRoom,
            leaveRoom,
            setRoomState // Exposed for playback updates
        }}>
            {children}
        </RoomContext.Provider>
    );
};
