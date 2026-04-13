import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
    autoConnect: false,
    // Match server transports — websocket first, polling as fallback for Windows/firewall issues
    transports: ['websocket', 'polling'],
    // Automatic reconnection for dropped connections
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // Faster timeout detection
    timeout: 20000,
});

// Debug logging for connection issues
socket.on('connect', () => {
    console.log(`[Socket] Connected with id: ${socket.id}, transport: ${socket.io.engine.transport.name}`);
});

socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
});

socket.on('reconnect', (attempt) => {
    console.log(`[Socket] Reconnected after ${attempt} attempts`);
});

socket.on('reconnect_error', (err) => {
    console.error('[Socket] Reconnection error:', err.message);
});

socket.io.on('ping', () => {
    console.log('[Socket] Ping sent');
});

export const connectSocket = () => {
    if (!socket.connected) {
        console.log('[Socket] Connecting to', SOCKET_URL);
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        console.log('[Socket] Disconnecting');
        socket.disconnect();
    }
};
