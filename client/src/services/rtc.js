import { socket } from './signaling';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ],
};

export class PeerConnection {
    constructor(remoteUserId, onTrack) {
        this.remoteUserId = remoteUserId;
        this.pc = new RTCPeerConnection(ICE_SERVERS);
        this.onTrack = onTrack;
        this.candidatesQueue = [];
        this.isRemoteDescriptionSet = false;

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal', {
                    to: this.remoteUserId,
                    signal: { type: 'candidate', candidate: event.candidate },
                });
            }
        };

        this.pc.ontrack = (event) => {
            if (this.onTrack) {
                this.onTrack(event.track, event.streams[0]);
            }
        };
    }

    addTrack(track, stream) {
        const sender = this.pc.addTrack(track, stream);

        // Apply encoding parameters for webcam tracks.
        // Only webcam tracks are sent through WebRTC now (movie plays locally on both sides).
        setTimeout(() => {
            if (!sender.track) return;

            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];

            if (sender.track.kind === "audio") {
                // Webcam mic — voice chat quality
                params.encodings[0].maxBitrate = 64_000;
                params.encodings[0].priority = "medium";
            } else if (sender.track.kind === "video") {
                // Webcam face cam
                params.encodings[0].maxBitrate = 1_000_000;
                params.encodings[0].priority = "medium";
            }

            sender.setParameters(params).catch(e => console.error("RTC Sender Params Error:", e));
        }, 100);
    }

    async createOffer() {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        socket.emit('signal', {
            to: this.remoteUserId,
            signal: { type: 'offer', sdp: offer },
        });
    }

    async handleSignal(signal) {
        try {
            if (signal.type === 'offer') {
                if (this.pc.signalingState !== 'stable') {
                    // If we get an offer but we're not stable, we might be in a race.
                    // For a simple app, we can ignore or rollback, but let's just proceed carefully.
                    console.warn('Received offer when not stable:', this.pc.signalingState);
                }
                await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                this.isRemoteDescriptionSet = true;
                this.processQueue();
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                socket.emit('signal', {
                    to: this.remoteUserId,
                    signal: { type: 'answer', sdp: answer },
                });
            } else if (signal.type === 'answer') {
                if (this.pc.signalingState === 'have-local-offer') {
                    await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    this.isRemoteDescriptionSet = true;
                    this.processQueue();
                } else {
                    console.warn('Received answer but signaling state is', this.pc.signalingState);
                }
            } else if (signal.type === 'candidate') {
                const candidate = new RTCIceCandidate(signal.candidate);
                if (this.isRemoteDescriptionSet) {
                    await this.pc.addIceCandidate(candidate).catch(e => console.error('Error adding ICE candidate:', e));
                } else {
                    this.candidatesQueue.push(candidate);
                }
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }

    async processQueue() {
        for (const candidate of this.candidatesQueue) {
            await this.pc.addIceCandidate(candidate).catch(e => console.error(e));
        }
        this.candidatesQueue = [];
    }

    close() {
        this.pc.close();
    }
}
