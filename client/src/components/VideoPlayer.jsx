import { useRef, useState, useEffect } from 'react';
import { useSyncPlayer } from '../hooks/useSyncPlayer';
import { Upload, Link as LinkIcon, Play } from 'lucide-react';
import { socket } from '../services/signaling';
import { useRoom } from '../context/RoomContext';

const YouTubePlayer = ({ url, isPlaying, onPlay, onPause, playerRef }) => {
    const containerRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const onPlayRef = useRef(onPlay);
    const onPauseRef = useRef(onPause);

    useEffect(() => {
        onPlayRef.current = onPlay;
        onPauseRef.current = onPause;
    }, [onPlay, onPause]);

    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1];

    useEffect(() => {
        if (!videoId || !containerRef.current) return;

        const loadYT = () => {
            if (ytPlayerRef.current) return;

            setTimeout(() => {
                ytPlayerRef.current = new window.YT.Player(containerRef.current, {
                    videoId,
                    playerVars: { autoplay: 1, controls: 1, rel: 0 },
                    events: {
                        onReady: (e) => {
                            if (playerRef) {
                                playerRef.current = {
                                    getCurrentTime: () => e.target.getCurrentTime(),
                                    seekTo: (sec) => e.target.seekTo(sec, true),
                                    play: () => e.target.playVideo(),
                                    pause: () => e.target.pauseVideo()
                                };
                            }
                            if (isPlaying) {
                                isSyncingRef.current = true;
                                e.target.playVideo();
                                setTimeout(() => { isSyncingRef.current = false; }, 500);
                            }
                        },
                        onStateChange: (e) => {
                            if (e.data === window.YT.PlayerState.PLAYING) onPlayRef.current();
                            if (e.data === window.YT.PlayerState.PAUSED) onPauseRef.current();
                        }
                    }
                });
            }, 100);
        };

        if (!window.YT) {
            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const script = document.createElement('script');
                script.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(script);
            }
            const oldReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (oldReady) oldReady();
                loadYT();
            };
        } else if (!window.YT.Player) {
            const oldReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (oldReady) oldReady();
                loadYT();
            };
        } else {
            loadYT();
        }

        return () => {
            if (ytPlayerRef.current && ytPlayerRef.current.destroy && ytPlayerRef.current.getIframe()) {
                ytPlayerRef.current.destroy();
                ytPlayerRef.current = null;
            }
        };
    }, [videoId]);

    useEffect(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.playVideo) {
            if (isPlaying) ytPlayerRef.current.playVideo();
            else ytPlayerRef.current.pauseVideo();
        }
    }, [isPlaying]);

    // window.YT replaces the node, so we need a wrapper div so React doesn't crash on unmount.
    return (
        <div className="w-full h-full bg-black flex items-center justify-center">
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
};

const NativeVideo = ({ url, isPlaying, onPlay, onPause, playerRef }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (playerRef) {
            playerRef.current = {
                getCurrentTime: () => videoRef.current?.currentTime || 0,
                seekTo: (sec) => { if (videoRef.current) videoRef.current.currentTime = sec; },
                play: () => videoRef.current?.play(),
                pause: () => videoRef.current?.pause(),
            };
        }
    }, [playerRef]);

    useEffect(() => {
        if (!videoRef.current) return;

        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = false;
    }, [url]);

    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(e => console.error("Native play error:", e));
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying]);

    return (
        <video
            ref={videoRef}
            src={url}
            controls
            className="w-full h-full object-contain"
            onPlay={onPlay}
            onPause={onPause}
        />
    );
};

const VideoPlayer = () => {
    const playerRef = useRef(null);
    const { roomId } = useRoom();
    const [inputUrl, setInputUrl] = useState('');

    const {
        isPlaying,
        videoUrl,
        emitState,
        changeVideoUrl,
    } = useSyncPlayer(playerRef);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            console.log("VideoPlayer: File selected, generated URL:", url);
            changeVideoUrl(url, true);
        }
    };

    const handleUrlSubmit = (e) => {
        e.preventDefault();
        if (inputUrl) {
            changeVideoUrl(inputUrl, false);
            setInputUrl('');
        }
    };

    const onPlay = () => {
        if (isPlaying) return; // Prevent loop: already playing locally
        console.log("VideoPlayer: onPlay triggered globally!");
        emitState('play');
    };

    const onPause = () => {
        if (!isPlaying) return; // Prevent loop: already paused locally
        console.log("VideoPlayer: onPause triggered globally!");
        emitState('pause');
    };

    return (
        <div className={`w-full h-full mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative flex items-center justify-center group ${!videoUrl ? 'max-w-4xl aspect-video' : ''}`}>
            {!videoUrl ? (
                <div className="text-center p-8 w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        {/* File Upload */}
                        <label className="cursor-pointer flex flex-col items-center gap-4 text-slate-300 hover:text-white transition-colors p-6 border-2 border-dashed border-slate-700 rounded-lg hover:border-slate-500">
                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                                <Upload size={24} />
                            </div>
                            <span className="font-medium">Select Video File</span>
                            <input
                                type="file"
                                accept="video/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>

                        <div className="flex items-center gap-4 text-slate-500">
                            <div className="h-px bg-slate-700 flex-1" />
                            <span>OR</span>
                            <div className="h-px bg-slate-700 flex-1" />
                        </div>

                        {/* URL Input */}
                        <form onSubmit={handleUrlSubmit} className="flex gap-2">
                            <div className="relative flex-1">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={inputUrl}
                                    onChange={(e) => setInputUrl(e.target.value)}
                                    placeholder="Paste YouTube or Video URL..."
                                    className="w-full bg-slate-800 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                            >
                                <Play size={20} />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full relative group overflow-hidden flex items-center justify-center">
                    {(videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) ? (
                        <YouTubePlayer
                            url={videoUrl}
                            isPlaying={isPlaying}
                            onPlay={onPlay}
                            onPause={onPause}
                            playerRef={playerRef}
                        />
                    ) : (
                        <NativeVideo
                            url={videoUrl}
                            isPlaying={isPlaying}
                            onPlay={onPlay}
                            onPause={onPause}
                            playerRef={playerRef}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
