import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../services/signaling';
import { useRoom } from '../context/RoomContext';

const DRIFT_THRESHOLD = 0.5; // seconds

export const useSyncPlayer = (playerRef) => {
    const { roomId, user } = useRoom();
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [videoUrl, setVideoUrl] = useState(null);
    const localFileUrlRef = useRef(null);

    const isRemoteUpdate = useRef(false);
    const isStarting = useRef(false);
    const lastSeekTime = useRef(0);

    useEffect(() => {
        if (!roomId) return;

        const handlePlaybackUpdate = (state) => {
            // state: { playing, currentTime, playbackRate, videoUrl, senderId }
            if (state.senderId === user.id) return;

            isRemoteUpdate.current = true;

            // Sync Video URL
            if (state.videoUrl) {
                if (state.videoUrl === 'LOCAL_FILE') {
                    // If server says LOCAL_FILE, use our local file if we have one
                    if (localFileUrlRef.current) {
                        setVideoUrl(localFileUrlRef.current);
                    } else {
                        // If we don't have a local file, clear videoUrl to show upload UI
                        setVideoUrl(null);
                    }
                } else if (state.videoUrl !== videoUrl) {
                    // It's a remote URL
                    setVideoUrl(state.videoUrl);
                    localFileUrlRef.current = null; // Clear local file ref
                }
            }

            const player = playerRef.current;
            if (!player) return;

            // Debugging player ref
            // console.log("Player Ref:", player);

            // Sync Play/Pause
            if (state.playing !== isPlaying) {
                setIsPlaying(state.playing);
                if (state.playing) {
                    // If we are playing via remote update, we are not "starting" locally anymore
                    isStarting.current = false;
                }
            }

            // Sync Time (Drift Correction)
            // Safety check for player API
            const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);

            if (currentTime !== null && typeof currentTime === 'number') {
                const drift = Math.abs(currentTime - state.currentTime);
                if (drift > DRIFT_THRESHOLD) {
                    console.log(`Drift ${drift}s. Seeking to ${state.currentTime}`);
                    if (player.seekTo) {
                        player.seekTo(state.currentTime, 'seconds');
                    } else if (player.currentTime !== undefined) {
                        player.currentTime = state.currentTime;
                    }
                }
            }

            // Sync Playback Rate
            if (state.playbackRate !== playbackRate) {
                setPlaybackRate(state.playbackRate);
            }

            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, 500);
        };

        const handlePlayAt = ({ playAt, currentTime }) => {
            console.log(`Scheduled play at ${playAt} (current: ${Date.now()})`);
            const now = Date.now();
            const delay = Math.max(0, playAt - now);

            isStarting.current = true; // Ensure we are in starting mode

            const player = playerRef.current;
            if (player) {
                if (player.seekTo) {
                    player.seekTo(currentTime, 'seconds');
                } else if (player.currentTime !== undefined) {
                    player.currentTime = currentTime;
                }

                setTimeout(() => {
                    setIsPlaying(true);
                    // Allow a grace period after starting before accepting pause events
                    setTimeout(() => {
                        isStarting.current = false;
                    }, 1000);
                }, delay);
            }
        };

        socket.on('playback-update', handlePlaybackUpdate);
        socket.on('play-at', handlePlayAt);

        return () => {
            socket.off('playback-update', handlePlaybackUpdate);
            socket.off('play-at', handlePlayAt);
        };
    }, [roomId, user.id, playerRef, videoUrl, isPlaying, playbackRate]);

    // Initial state load
    useEffect(() => {
        socket.on('room-state', (state) => {
            if (state.playbackState) {
                if (state.playbackState.videoUrl === 'LOCAL_FILE') {
                    if (localFileUrlRef.current) {
                        setVideoUrl(localFileUrlRef.current);
                    } else {
                        setVideoUrl(null);
                    }
                } else {
                    setVideoUrl(state.playbackState.videoUrl);
                }

                setIsPlaying(state.playbackState.playing);
                setPlaybackRate(state.playbackState.playbackRate);
                if (playerRef.current && state.playbackState.currentTime) {
                    playerRef.current.seekTo(state.playbackState.currentTime, 'seconds');
                }
            }
        });
    }, []);

    const emitState = (type, value) => {
        if (isRemoteUpdate.current || !roomId || !playerRef.current) return;

        const player = playerRef.current;
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);

        const state = {
            playing: type === 'pause' ? false : (type === 'play' ? true : isPlaying),
            currentTime: type === 'seek' ? value : currentTime,
            playbackRate: type === 'rate' ? value : playbackRate,
            videoUrl: localFileUrlRef.current ? 'LOCAL_FILE' : videoUrl,
            type
        };

        if (type === 'pause') setIsPlaying(false);
        if (type === 'play') setIsPlaying(true);
        if (type === 'rate') setPlaybackRate(value);

        socket.emit('playback-update', { roomId, state });
    };

    const changeVideoUrl = (url, isLocal = false) => {
        if (isLocal) {
            localFileUrlRef.current = url;
            setVideoUrl(url);
            socket.emit('change-video', { roomId, videoUrl: 'LOCAL_FILE' });
        } else {
            localFileUrlRef.current = null;
            setVideoUrl(url);
            socket.emit('change-video', { roomId, videoUrl: url });
        }
        setIsPlaying(false);
        if (playerRef.current && playerRef.current.seekTo) {
            playerRef.current.seekTo(0);
        }
    };

    return {
        isPlaying,
        playbackRate,
        videoUrl,
        emitState,
        changeVideoUrl,
        handleDuration: (duration) => { /* Optional */ },
        handleProgress: (state) => { /* Optional */ },
        handleReady: () => { /* Optional */ }
    };
};
