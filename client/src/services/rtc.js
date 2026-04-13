import { socket } from './signaling';

// STUN + TURN servers for reliable NAT traversal across different platforms/networks.
// STUN alone fails when peers are behind symmetric NATs (common on Windows/corporate networks).
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // Free TURN servers for relay when direct connection fails
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
    iceCandidatePoolSize: 10,
};

export class PeerConnection {
    constructor(remoteUserId, onTrack, onConnectionStateChange) {
        this.remoteUserId = remoteUserId;
        this.pc = new RTCPeerConnection(ICE_SERVERS);
        this.onTrack = onTrack;
        this.onConnectionStateChange = onConnectionStateChange;
        this.candidatesQueue = [];
        this.isRemoteDescriptionSet = false;
        this.isClosed = false;
        this._restartAttempts = 0;
        this._maxRestartAttempts = 3;
        this._connectionTimeout = null;

        console.log(`[RTC] Creating PeerConnection for remote user: ${remoteUserId}`);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[RTC] Sending ICE candidate to ${this.remoteUserId}:`, event.candidate.type, event.candidate.protocol);
                socket.emit('signal', {
                    to: this.remoteUserId,
                    signal: { type: 'candidate', candidate: event.candidate },
                });
            } else {
                console.log(`[RTC] ICE gathering complete for ${this.remoteUserId}`);
            }
        };

        this.pc.oniceconnectionstatechange = () => {
            const state = this.pc.iceConnectionState;
            console.log(`[RTC] ICE connection state for ${this.remoteUserId}: ${state}`);

            if (state === 'connected' || state === 'completed') {
                this._restartAttempts = 0;
                this._clearConnectionTimeout();
                if (this.onConnectionStateChange) {
                    this.onConnectionStateChange(this.remoteUserId, 'connected');
                }
            } else if (state === 'failed') {
                console.warn(`[RTC] ICE connection FAILED for ${this.remoteUserId}. Attempting ICE restart...`);
                this._attemptIceRestart();
            } else if (state === 'disconnected') {
                console.warn(`[RTC] ICE connection DISCONNECTED for ${this.remoteUserId}. Waiting for recovery...`);
                // Give it 5 seconds to recover before attempting restart
                this._connectionTimeout = setTimeout(() => {
                    if (this.pc && this.pc.iceConnectionState === 'disconnected') {
                        console.warn(`[RTC] Connection did not recover. Attempting ICE restart...`);
                        this._attemptIceRestart();
                    }
                }, 5000);
            }
        };

        this.pc.onicegatheringstatechange = () => {
            console.log(`[RTC] ICE gathering state for ${this.remoteUserId}: ${this.pc.iceGatheringState}`);
        };

        this.pc.onsignalingstatechange = () => {
            console.log(`[RTC] Signaling state for ${this.remoteUserId}: ${this.pc.signalingState}`);
        };

        this.pc.ontrack = (event) => {
            console.log(`[RTC] Received track from ${this.remoteUserId}: kind=${event.track.kind}, streamId=${event.streams[0]?.id}`);
            if (this.onTrack && event.streams[0]) {
                this.onTrack(event.track, event.streams[0]);
            }
        };

        // Set a connection timeout — if not connected within 15 seconds, try ICE restart
        this._connectionTimeout = setTimeout(() => {
            if (this.pc && this.pc.iceConnectionState !== 'connected' && this.pc.iceConnectionState !== 'completed') {
                console.warn(`[RTC] Connection timeout for ${this.remoteUserId} (state: ${this.pc.iceConnectionState}). Attempting ICE restart...`);
                this._attemptIceRestart();
            }
        }, 15000);
    }

    _clearConnectionTimeout() {
        if (this._connectionTimeout) {
            clearTimeout(this._connectionTimeout);
            this._connectionTimeout = null;
        }
    }

    async _attemptIceRestart() {
        if (this.isClosed) return;
        if (this._restartAttempts >= this._maxRestartAttempts) {
            console.error(`[RTC] Max ICE restart attempts reached for ${this.remoteUserId}. Giving up.`);
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.remoteUserId, 'failed');
            }
            return;
        }

        this._restartAttempts++;
        console.log(`[RTC] ICE restart attempt ${this._restartAttempts}/${this._maxRestartAttempts} for ${this.remoteUserId}`);

        try {
            const offer = await this.pc.createOffer({ iceRestart: true });
            await this.pc.setLocalDescription(offer);
            socket.emit('signal', {
                to: this.remoteUserId,
                signal: { type: 'offer', sdp: offer },
            });
        } catch (err) {
            console.error(`[RTC] ICE restart failed for ${this.remoteUserId}:`, err);
        }
    }

    addTrack(track, stream) {
        try {
            const sender = this.pc.addTrack(track, stream);

            // Apply encoding parameters for webcam video tracks.
            // Only video tracks are sent (no audio to avoid interfering with movie sound).
            setTimeout(() => {
                if (!sender.track || sender.track.kind !== "video") return;

                const params = sender.getParameters();
                if (!params.encodings) params.encodings = [{}];

                // Webcam face cam — keep bandwidth reasonable
                params.encodings[0].maxBitrate = 1_000_000;
                params.encodings[0].priority = "medium";

                sender.setParameters(params).catch(e => console.error("[RTC] Sender Params Error:", e));
            }, 100);
        } catch (err) {
            console.error(`[RTC] Error adding track to peer ${this.remoteUserId}:`, err);
        }
    }

    async createOffer() {
        try {
            console.log(`[RTC] Creating offer for ${this.remoteUserId}`);
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            socket.emit('signal', {
                to: this.remoteUserId,
                signal: { type: 'offer', sdp: offer },
            });
        } catch (err) {
            console.error(`[RTC] Error creating offer for ${this.remoteUserId}:`, err);
        }
    }

    async handleSignal(signal) {
        if (this.isClosed) {
            console.warn(`[RTC] Received signal for closed connection ${this.remoteUserId}. Ignoring.`);
            return;
        }

        try {
            if (signal.type === 'offer') {
                console.log(`[RTC] Received offer from ${this.remoteUserId}. Signaling state: ${this.pc.signalingState}`);

                // Handle glare (simultaneous offers) by rolling back if needed
                if (this.pc.signalingState !== 'stable') {
                    console.warn(`[RTC] Rolling back local description due to glare with ${this.remoteUserId}`);
                    await this.pc.setLocalDescription({ type: 'rollback' });
                    this.isRemoteDescriptionSet = false;
                }

                await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                this.isRemoteDescriptionSet = true;
                this.processQueue();

                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);

                console.log(`[RTC] Sending answer to ${this.remoteUserId}`);
                socket.emit('signal', {
                    to: this.remoteUserId,
                    signal: { type: 'answer', sdp: answer },
                });
            } else if (signal.type === 'answer') {
                if (this.pc.signalingState === 'have-local-offer') {
                    console.log(`[RTC] Received answer from ${this.remoteUserId}`);
                    await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    this.isRemoteDescriptionSet = true;
                    this.processQueue();
                } else {
                    console.warn(`[RTC] Received answer but signaling state is ${this.pc.signalingState} for ${this.remoteUserId}`);
                }
            } else if (signal.type === 'candidate') {
                const candidate = new RTCIceCandidate(signal.candidate);
                if (this.isRemoteDescriptionSet) {
                    await this.pc.addIceCandidate(candidate).catch(e =>
                        console.error(`[RTC] Error adding ICE candidate from ${this.remoteUserId}:`, e)
                    );
                } else {
                    console.log(`[RTC] Queuing ICE candidate from ${this.remoteUserId} (remote desc not set yet)`);
                    this.candidatesQueue.push(candidate);
                }
            }
        } catch (error) {
            console.error(`[RTC] Error handling signal from ${this.remoteUserId}:`, error);
        }
    }

    async processQueue() {
        console.log(`[RTC] Processing ${this.candidatesQueue.length} queued candidates for ${this.remoteUserId}`);
        for (const candidate of this.candidatesQueue) {
            await this.pc.addIceCandidate(candidate).catch(e =>
                console.error(`[RTC] Error adding queued ICE candidate:`, e)
            );
        }
        this.candidatesQueue = [];
    }

    close() {
        console.log(`[RTC] Closing PeerConnection for ${this.remoteUserId}`);
        this.isClosed = true;
        this._clearConnectionTimeout();
        this.pc.close();
    }
}
