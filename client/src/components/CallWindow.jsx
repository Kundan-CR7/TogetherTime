import { useEffect, useRef, useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { socket } from '../services/signaling';
import { PeerConnection } from '../services/rtc';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

const CallWindow = () => {
    const { user, roomState } = useRoom();
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const peersRef = useRef({});
    const localVideoRef = useRef(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    useEffect(() => {
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        googAutoGainControl: false,       // Chrome specific
                        googNoiseSuppression: false,      // Chrome specific
                        googHighpassFilter: false,        // Chrome specific
                        googAudioMirroring: false,        // Chrome specific
                        googNoiseReduction: false         // Chrome specific
                    }
                });
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Once we have our local stream ready, notify others in the room
                socket.emit('join-call', { roomId: user.roomId || window.location.pathname.split('/').pop() }); // Get roomId from URL if not in context
            } catch (err) {
                console.error('Error accessing media devices:', err);
            }
        };

        initMedia();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            Object.values(peersRef.current).forEach(peer => peer.close());
        };
    }, []);

    useEffect(() => {
        if (!localStream) return;

        // Handle new users completing their media setup
        const handleUserConnected = async (newUserId) => {
            if (newUserId === user.id) return;
            console.log('Initiating call to', newUserId);
            const peer = new PeerConnection(newUserId, (track, stream) => {
                console.log('Received track from new user', newUserId, 'Track:', track.kind, 'Stream ID:', stream.id, 'Tracks in Stream:', stream.getTracks().length);
                setRemoteStreams(prev => {
                    if (prev[newUserId] && prev[newUserId].id !== stream.id) {
                        return prev; // Ignore secondary streams (like the explicit movie stream) so they don't overwrite the webcam UI
                    }
                    return { ...prev, [newUserId]: stream };
                });
            });

            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

            const waitForMovie = async () => {
                while (!window.movieStreamReady) {
                    await new Promise(r => setTimeout(r, 100));
                }
            };
            await waitForMovie();

            if (window.movieStreamReady && window.movieStream) {
                window.movieStream.getTracks().forEach(track => {
                    peer.addTrack(track, window.movieStream);
                });
            }

            peer.createOffer();

            console.table(
                peer.pc.getSenders().map(s => ({
                    kind: s.track?.kind,
                    hint: s.track?.contentHint
                }))
            );

            peersRef.current[newUserId] = peer;
        };

        // Handle signals
        const handleSignal = async ({ from, signal }) => {
            let peer = peersRef.current[from];
            if (!peer) {
                console.log('Receiving call from', from);
                peer = new PeerConnection(from, (track, stream) => {
                    console.log('Received track from signaling user', from, 'Track:', track.kind, 'Stream ID:', stream.id, 'Tracks in Stream:', stream.getTracks().length);
                    setRemoteStreams(prev => {
                        if (prev[from] && prev[from].id !== stream.id) {
                            return prev;
                        }
                        return { ...prev, [from]: stream };
                    });
                });
                localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

                const waitForMovie = async () => {
                    while (!window.movieStreamReady) {
                        await new Promise(r => setTimeout(r, 100));
                    }
                };
                await waitForMovie();

                if (window.movieStreamReady && window.movieStream) {
                    window.movieStream.getTracks().forEach(track => {
                        peer.addTrack(track, window.movieStream);
                    });
                }

                peersRef.current[from] = peer;

                setTimeout(() => {
                    console.table(
                        peer.pc.getSenders().map(s => ({
                            kind: s.track?.kind,
                            hint: s.track?.contentHint
                        }))
                    );
                }, 100);
            }
            await peer.handleSignal(signal);
        };

        // Handle user leaving
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

        // If we just joined, we might need to wait for others to call us OR call existing users?
        // In this simple mesh, usually the joiner calls everyone or everyone calls the joiner.
        // My server logic emits 'user-joined' to others. So others will call the joiner.
        // But the joiner needs to be ready to receive.

        // Also, for existing users in the room when I join:
        // The server sends 'room-state'. I should probably initiate calls to them?
        // Or wait for them to call me?
        // The 'user-joined' event is sent to OTHERS. So OTHERS will call ME.
        // So I just need to handle incoming signals.

        return () => {
            socket.off('user-connected', handleUserConnected);
            socket.off('signal', handleSignal);
            socket.off('user-left', handleUserLeft);
        };
    }, [localStream, user.id]);

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
            videoRef.current.play().catch(err => console.error("VideoRenderer Autoplay Error:", err));
        }
    }, [stream]);

    return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
};

export default CallWindow;
