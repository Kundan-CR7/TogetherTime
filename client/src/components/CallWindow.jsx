import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../context/RoomContext';
import { socket } from '../services/signaling';
import { PeerConnection } from '../services/rtc';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

const CallWindow = () => {
    const { user, roomState, roomId } = useRoom();
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const peersRef = useRef({});
    const localVideoRef = useRef(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    // Track when user is fully joined
    const [isJoined, setIsJoined] = useState(false);

    const initMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            return stream;
        } catch (err) {
            console.error('Error accessing media devices:', err);
            return null;
        }
    }, []);

    useEffect(() => {
        let stream = null;
        
        const setup = async () => {
             stream = await initMedia();
             if (user.id && user.id === socket.id && stream) {
                 setIsJoined(true);
                 socket.emit('join-call', { roomId: roomId || window.location.pathname.split('/').pop() });
             }
        };

        if (user.id && user.id === socket.id && !isJoined) {
            setup();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            // Cannot clean up peersRef.current here cleanly without breaking HMR or reconnections
        };
    }, [user.id, initMedia]);

    useEffect(() => {
        if (!isJoined || !localStream || !user.id || user.id !== socket.id) return;

        console.log("Setting up socket listeners for WebRTC...");

        const handleUserConnected = async (newUserId) => {
            if (newUserId === user.id) return;
            console.log('Initiating call to', newUserId);
            
            if (peersRef.current[newUserId]) {
                peersRef.current[newUserId].close();
            }

            const peer = new PeerConnection(newUserId, (track, stream) => {
                console.log('Received track from new user', newUserId, 'Track:', track.kind, 'Stream ID:', stream.id);
                setRemoteStreams(prev => {
                    const existing = prev[newUserId];
                    // If we already have a stream for this user, only update if same stream ID
                    // (handles ontrack firing separately for audio and video of the same webcam stream).
                    // If a different stream ID arrives (movie stream), skip it.
                    if (existing && existing.id !== stream.id) {
                        return prev;
                    }
                    return { ...prev, [newUserId]: stream };
                });
            });

            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

            peer.createOffer();
            peersRef.current[newUserId] = peer;
        };

        const handleSignal = async ({ from, signal }) => {
            let peer = peersRef.current[from];
            
            if (!peer && signal.type === 'offer') {
                console.log('Receiving call from unseen user', from);
                peer = new PeerConnection(from, (track, stream) => {
                    console.log('Received track from signaling user', from, 'Track:', track.kind, 'Stream ID:', stream.id);
                    setRemoteStreams(prev => {
                        const existing = prev[from];
                        // Same logic: keep first stream (webcam), ignore subsequent different streams (movie)
                        if (existing && existing.id !== stream.id) {
                            return prev;
                        }
                        return { ...prev, [from]: stream };
                    });
                });
                
                localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
                
                peersRef.current[from] = peer;
            }
            
            if (peer) {
                await peer.handleSignal(signal);
            }
        };

        const handleUserLeft = (userId) => {
            if (peersRef.current[userId]) {
                peersRef.current[userId].close();
                delete peersRef.current[userId];
                setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[userId];
                    return newStreams;
                });
            }
        };

        socket.on('user-connected', handleUserConnected);
        socket.on('signal', handleSignal);
        socket.on('user-left', handleUserLeft);

        return () => {
            socket.off('user-connected', handleUserConnected);
            socket.off('signal', handleSignal);
            socket.off('user-left', handleUserLeft);
        };
    }, [localStream, user.id, isJoined]);

    // Clean up on unmount entirely
    useEffect(() => {
        return () => {
             Object.values(peersRef.current).forEach(peer => peer.close());
             peersRef.current = {};
        }
    }, []);

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-slate-900 rounded-lg h-full overflow-hidden">
            <div className="flex flex-col gap-y-4 flex-1 overflow-y-auto overflow-x-hidden p-1">
                {/* Local Video */}
                <div className="relative aspect-video bg-slate-800 rounded-md overflow-hidden shrink-0">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">You</div>
                </div>

                {/* Remote Videos */}
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <div key={peerId} className="relative aspect-video bg-slate-800 rounded-md overflow-hidden shrink-0">
                        <VideoRenderer stream={stream} />
                        <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                            {roomState.users[peerId]?.name || 'User'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4 py-2">
                <button onClick={toggleMute} className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-slate-700 hover:bg-slate-600'} text-white transition-colors`}>
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-slate-700 hover:bg-slate-600'} text-white transition-colors`}>
                    {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
            </div>
        </div>
    );
};

const VideoRenderer = ({ stream }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            // Ensure audio is not muted for remote streams
            videoRef.current.muted = false;
            videoRef.current.volume = 1.0;
            videoRef.current.play().catch(err => {
                console.error("VideoRenderer Autoplay Error:", err);
                // If autoplay with audio fails due to browser policy, try muted first then unmute
                if (videoRef.current) {
                    videoRef.current.muted = true;
                    videoRef.current.play().then(() => {
                        // Unmute after playback starts (user interaction may be needed)
                        setTimeout(() => {
                            if (videoRef.current) videoRef.current.muted = false;
                        }, 100);
                    }).catch(e => console.error("VideoRenderer fallback play error:", e));
                }
            });
        }
    }, [stream]);

    return <video ref={videoRef} autoPlay playsInline muted={false} className="w-full h-full object-cover" />;
};

export default CallWindow;
