import { useEffect, useRef, useState } from 'react';
import { socket } from '../services/signaling';
import { useRoom } from '../context/RoomContext';

const DRIFT_THRESHOLD = 0.5; // seconds

export const useSyncPlayer = (videoRef, videoSrc) => {
    const { roomId, user } = useRoom();
    const [isPlaying, setIsPlaying] = useState(false);
    const isRemoteUpdate = useRef(false);

    useEffect(() => {
        if (!roomId || !videoSrc || !videoRef.current) return;

        const handlePlaybackUpdate = (state) => {
            // state: { playing, currentTime, playbackRate, senderId }
            if (state.senderId === user.id) return; // Ignore own updates

            const video = videoRef.current;
            if (!video) return;

            isRemoteUpdate.current = true;

            // Sync Play/Pause
            let justStarted = false;
            if (state.playing !== !video.paused) {
                if (state.playing) {
                    video.play().catch(e => console.error("Auto-play prevented", e));
                    setIsPlaying(true);
                    justStarted = true;
                } else {
                    video.pause();
                    setIsPlaying(false);
                }
            }

            // Sync Time (Drift Correction)
            const drift = Math.abs(video.currentTime - state.currentTime);
            // Use tighter threshold if we just started playing to ensure initial sync
            const currentThreshold = justStarted ? 0.05 : DRIFT_THRESHOLD;

            if (drift > currentThreshold) {
                console.log(`Drift detected: ${drift}s (Threshold: ${currentThreshold}s). Seeking to ${state.currentTime}`);
                video.currentTime = state.currentTime;
            }

            // Sync Playback Rate
            if (video.playbackRate !== state.playbackRate) {
                video.playbackRate = state.playbackRate;
            }

            // Reset flag after a short delay to allow events to fire without triggering emit
            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, 100);
        };

        socket.on('playback-update', handlePlaybackUpdate);

        // Request current state when joining/uploading
        // socket.emit('request-state', { roomId }); // Optional: Good for late joiners

        return () => {
            socket.off('playback-update', handlePlaybackUpdate);
        };
    }, [roomId, user.id, videoRef, videoSrc]);

    const emitState = (type) => {
        if (isRemoteUpdate.current || !roomId || !videoRef.current) return;

        const video = videoRef.current;
        const state = {
            playing: !video.paused,
            currentTime: video.currentTime,
            playbackRate: video.playbackRate,
            type // 'play', 'pause', 'seek', 'rate'
        };

        socket.emit('playback-update', { roomId, state });
        setIsPlaying(!video.paused);
    };

    return {
        emitState,
        isPlaying
    };
};
