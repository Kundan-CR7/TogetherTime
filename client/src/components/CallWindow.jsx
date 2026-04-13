import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../context/RoomContext';
import { socket } from '../services/signaling';
import { PeerConnection } from '../services/rtc';
import { Video, VideoOff, AlertTriangle } from 'lucide-react';

const CallWindow = () => {
    const { user, roomState, roomId } = useRoom();
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [connectionStates, setConnectionStates] = useState({});
    const peersRef = useRef({});
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const isJoinedRef = useRef(false);

    // Keep refs in sync for use in callbacks
    useEffect(() => {
        localStreamRef.current = localStream;
    }, [localStream]);

    useEffect(() => {
        isJoinedRef.current = isJoined;
    }, [isJoined]);

    const handleConnectionStateChange = useCallback((remoteUserId, state) => {
        console.log(`[CallWindow] Connection state change for ${remoteUserId}: ${state}`);
        setConnectionStates(prev => ({ ...prev, [remoteUserId]: state }));
    }, []);

    const createPeerForUser = useCallback((remoteUserId, stream) => {
        console.log(`[CallWindow] Creating peer for ${remoteUserId}`);

        // Clean up existing peer if any
        if (peersRef.current[remoteUserId]) {
            peersRef.current[remoteUserId].close();
            delete peersRef.current[remoteUserId];
        }

        const peer = new PeerConnection(
            remoteUserId,
            (track, remoteStream) => {
                console.log(`[CallWindow] Received remote track from ${remoteUserId}: ${track.kind}, stream: ${remoteStream.id}`);

                // Always update with the latest stream — don't filter by stream ID.
                // The old logic was too aggressive and could drop legitimate re-negotiated streams.
                setRemoteStreams(prev => ({ ...prev, [remoteUserId]: remoteStream }));

                // Handle track ending (peer stopped video)
                track.onended = () => {
                    console.log(`[CallWindow] Remote track ended from ${remoteUserId}: ${track.kind}`);
                };

                track.onmute = () => {
                    console.log(`[CallWindow] Remote track muted from ${remoteUserId}: ${track.kind}`);
                };

                track.onunmute = () => {
                    console.log(`[CallWindow] Remote track unmuted from ${remoteUserId}: ${track.kind}`);
                };
            },
            handleConnectionStateChange
        );

        // Add local tracks
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log(`[CallWindow] Adding local track ${track.kind} to peer ${remoteUserId}`);
                peer.addTrack(track, stream);
            });
        }

        peersRef.current[remoteUserId] = peer;
        return peer;
    }, [handleConnectionStateChange]);

    const initMedia = useCallback(async () => {
        try {
            // Only request video — no audio so it doesn't interfere with movie sound
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 24, max: 30 }
                },
                audio: false
            });

            setLocalStream(stream);
            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            console.log('[CallWindow] Local media initialized. Tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
            return stream;
        } catch (err) {
            console.error('[CallWindow] Error accessing media devices:', err);
            return null;
        }
    }, []);

    // Main setup effect: get media, set up socket listeners, THEN join call
    // This fixes the race condition where join-call was emitted before listeners were ready
    useEffect(() => {
        if (!user.id || user.id !== socket.id || isJoinedRef.current) return;

        let stream = null;
        let cleanedUp = false;

        const setup = async () => {
            // Step 1: Get local media
            stream = await initMedia();
            if (!stream || cleanedUp) return;

            // Step 2: Set up all socket listeners FIRST
            console.log('[CallWindow] Setting up socket listeners...');

            const handleUserConnected = async (newUserId) => {
                if (newUserId === socket.id) return;
                console.log(`[CallWindow] User connected: ${newUserId}. Initiating call.`);

                const currentStream = localStreamRef.current;
                const peer = createPeerForUser(newUserId, currentStream);
                peer.createOffer();
            };

            const handleSignal = async ({ from, signal }) => {
                let peer = peersRef.current[from];

                if (!peer && signal.type === 'offer') {
                    console.log(`[CallWindow] Received offer from unknown peer ${from}. Creating peer.`);
                    const currentStream = localStreamRef.current;
                    peer = createPeerForUser(from, currentStream);
                }

                if (peer) {
                    await peer.handleSignal(signal);
                } else {
                    console.warn(`[CallWindow] Received signal from ${from} but no peer exists and signal type is ${signal.type}`);
                }
            };

            const handleUserLeft = (userId) => {
                console.log(`[CallWindow] User left: ${userId}`);
                if (peersRef.current[userId]) {
                    peersRef.current[userId].close();
                    delete peersRef.current[userId];
                    setRemoteStreams(prev => {
                        const newStreams = { ...prev };
                        delete newStreams[userId];
                        return newStreams;
                    });
                    setConnectionStates(prev => {
                        const newStates = { ...prev };
                        delete newStates[userId];
                        return newStates;
                    });
                }
            };

            socket.on('user-connected', handleUserConnected);
            socket.on('signal', handleSignal);
            socket.on('user-left', handleUserLeft);

            // Step 3: NOW join the call (so existing users send us offers AFTER our listeners are ready)
            const effectiveRoomId = roomId || window.location.pathname.split('/').pop();
            console.log(`[CallWindow] Joining call in room ${effectiveRoomId}`);
            socket.emit('join-call', { roomId: effectiveRoomId });

            setIsJoined(true);
            isJoinedRef.current = true;

            // Store cleanup handlers on the stream object for the cleanup function
            stream._socketCleanup = () => {
                socket.off('user-connected', handleUserConnected);
                socket.off('signal', handleSignal);
                socket.off('user-left', handleUserLeft);
            };
        };

        setup();

        return () => {
            cleanedUp = true;
            if (stream && stream._socketCleanup) {
                stream._socketCleanup();
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [user.id, initMedia, createPeerForUser, roomId]);

    // Clean up all peers on unmount
    useEffect(() => {
        return () => {
            Object.values(peersRef.current).forEach(peer => peer.close());
            peersRef.current = {};
        };
    }, []);

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
                    {isVideoOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/90">
                            <VideoOff size={24} className="text-slate-500" />
                        </div>
                    )}
                </div>

                {/* Remote Videos */}
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                    <div key={peerId} className="relative aspect-video bg-slate-800 rounded-md overflow-hidden shrink-0">
                        <VideoRenderer stream={stream} />
                        <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded flex items-center gap-1">
                            {connectionStates[peerId] === 'failed' && (
                                <AlertTriangle size={12} className="text-red-400" />
                            )}
                            {roomState.users[peerId]?.name || 'User'}
                        </div>
                        {connectionStates[peerId] === 'failed' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80">
                                <div className="text-center">
                                    <AlertTriangle size={24} className="text-red-400 mx-auto mb-1" />
                                    <span className="text-xs text-red-300">Connection lost</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4 py-2">
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
        const videoEl = videoRef.current;
        if (!videoEl || !stream) return;

        // Always reassign srcObject when stream changes
        videoEl.srcObject = stream;
        // Mute remote streams so they don't interfere with the movie audio
        videoEl.muted = true;
        videoEl.volume = 0;

        const playPromise = videoEl.play();
        if (playPromise) {
            playPromise.catch(err => {
                console.error("[VideoRenderer] Autoplay Error:", err);
                // Retry play on user interaction
                const retry = () => {
                    videoEl.play().catch(() => {});
                    document.removeEventListener('click', retry);
                };
                document.addEventListener('click', retry, { once: true });
            });
        }

        // Listen for the stream's tracks becoming active
        const handleTrackAdded = () => {
            console.log('[VideoRenderer] Track added to stream, re-assigning');
            videoEl.srcObject = stream;
            videoEl.play().catch(() => {});
        };

        stream.addEventListener('addtrack', handleTrackAdded);

        return () => {
            stream.removeEventListener('addtrack', handleTrackAdded);
        };
    }, [stream]);

    return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
};

export default CallWindow;
