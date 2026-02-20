import { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { useSyncPlayer } from '../hooks/useSyncPlayer';
import { Upload, Link as LinkIcon, Play } from 'lucide-react';
import { socket } from '../services/signaling';
import { useRoom } from '../context/RoomContext';

const VideoPlayer = () => {
    const playerRef = useRef(null);
    const { roomId } = useRoom();
    const [inputUrl, setInputUrl] = useState('');

    // We'll manage videoSrc via the hook/socket updates mostly, 
    // but we need a local state to render the player initially if we pick a file.
    // Actually, useSyncPlayer should probably return the current videoUrl from the room state.

    const {
        isPlaying,
        playbackRate,
        videoUrl,
        emitState,
        setLocalUrl,
        handleDuration,
        handleProgress,
        handleReady
    } = useSyncPlayer(playerRef);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            console.log("VideoPlayer: File selected, generated URL:", url);
            setLocalUrl(url);
            socket.emit('change-video', { roomId, videoUrl: 'LOCAL_FILE' });
        }
    };

    const handleUrlSubmit = (e) => {
        e.preventDefault();
        if (inputUrl) {
            socket.emit('change-video', { roomId, videoUrl: inputUrl });
            setInputUrl('');
        }
    };

    // Wrapper for ReactPlayer callbacks
    const onPlay = () => {
        console.log("VideoPlayer: onPlay triggered");
        emitState('play');
    };
    const onPause = () => {
        console.log("VideoPlayer: onPause triggered");
        emitState('pause');
    };
    const onSeek = (seconds) => {
        console.log("VideoPlayer: onSeek triggered", seconds);
        emitState('seek', seconds);
    };
    const onPlaybackRateChange = (rate) => emitState('rate', rate);
    const onReady = () => {
        console.log("VideoPlayer: onReady triggered");
        handleReady();
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative aspect-video flex items-center justify-center group">
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
                <div className="w-full h-full relative group">
                    <ReactPlayer
                        key={videoUrl}
                        ref={playerRef}
                        url={videoUrl}
                        width="100%"
                        height="100%"
                        playing={isPlaying}
                        playbackRate={playbackRate}
                        controls={false} // Disable native controls
                        onPlay={onPlay}
                        onPause={onPause}
                        onSeek={onSeek}
                        onPlaybackRateChange={onPlaybackRateChange}
                        onProgress={handleProgress}
                        onDuration={handleDuration}
                        onReady={onReady}
                        config={{
                            youtube: {
                                playerVars: { showinfo: 1, controls: 0 }
                            }
                        }}
                    />

                    {/* Custom Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button
                            onClick={isPlaying ? onPause : onPlay}
                            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-sm transition-all transform hover:scale-110"
                        >
                            {isPlaying ? (
                                <div className="w-6 h-6 flex gap-1 justify-center items-center">
                                    <div className="w-2 h-6 bg-white rounded-sm" />
                                    <div className="w-2 h-6 bg-white rounded-sm" />
                                </div>
                            ) : (
                                <Play size={24} fill="currentColor" />
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
