import { useRef, useState, useEffect } from 'react';
import { useSyncPlayer } from '../hooks/useSyncPlayer';
import { Upload } from 'lucide-react';

const VideoPlayer = () => {
    const videoRef = useRef(null);
    const [videoSrc, setVideoSrc] = useState(null);
    const { emitState } = useSyncPlayer(videoRef, videoSrc);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
        }
    };

    // Event handlers wrapper to emit state
    const handlePlay = () => emitState('play');
    const handlePause = () => emitState('pause');
    const handleSeek = () => emitState('seek');
    const handleRateChange = () => emitState('rate');

    return (
        <div className="w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative aspect-video flex items-center justify-center">
            {!videoSrc ? (
                <div className="text-center p-8">
                    <label className="cursor-pointer flex flex-col items-center gap-4 text-slate-300 hover:text-white transition-colors">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                            <Upload size={32} />
                        </div>
                        <span className="text-lg font-medium">Select Video File</span>
                        <span className="text-sm text-slate-500">Both users must select the same file</span>
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-full"
                    controls
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeek}
                    onRateChange={handleRateChange}
                />
            )}
        </div>
    );
};

export default VideoPlayer;
