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
                this.onTrack(event.streams[0]);
            }
        };
    }

    addTrack(track, stream) {
        this.pc.addTrack(track, stream);
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
        if (signal.type === 'offer') {
            await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            socket.emit('signal', {
                to: this.remoteUserId,
                signal: { type: 'answer', sdp: answer },
            });
        } else if (signal.type === 'answer') {
            await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'candidate') {
            await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    }

    close() {
        this.pc.close();
    }
}
