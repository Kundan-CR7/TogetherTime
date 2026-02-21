import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import VideoPlayer from '../components/VideoPlayer';
import CallWindow from '../components/CallWindow';
import { Copy, ArrowLeft } from 'lucide-react';

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user, joinRoom, leaveRoom, isConnected, hasVideo } = useRoom();

    useEffect(() => {
        if (!user.name) {
            // If user refreshed page, redirect to home to enter name
            navigate('/');
        } else if (roomId && !isConnected) {
            // Auto-join if we have a name and room ID but aren't connected
            joinRoom(roomId, user.name);
        }
    }, [user.name, roomId, isConnected, joinRoom, navigate]);

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        alert('Room ID copied to clipboard!');
    };

    const handleLeave = () => {
        leaveRoom();
        navigate('/');
    };

    return (
        <div className="h-screen overflow-hidden bg-slate-950 text-white flex flex-col relative group/room">
            {/* Header */}
            <div className={`transition-all duration-500 overflow-hidden ${hasVideo ? 'h-0 opacity-0 absolute pointer-events-none' : 'h-[72px] opacity-100 relative'}`}>
                <header className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between h-full">
                    <div className="flex items-center gap-4">
                        <button onClick={handleLeave} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="font-bold text-lg">Room: <span className="text-indigo-400">{roomId}</span></h1>
                        <button onClick={copyRoomId} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors" title="Copy Room ID">
                            <Copy size={16} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-slate-400">{user.name}</span>
                    </div>
                </header>
            </div>

            {hasVideo && (
                <button onClick={handleLeave} className="absolute top-4 left-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white opacity-0 hover:opacity-100 group-hover/room:opacity-100 peer">
                    <ArrowLeft size={20} />
                </button>
            )}

            {/* Main Content */}
            <main className="flex-1 p-4 flex gap-4 overflow-hidden h-full">
                {/* Video Area */}
                <div className="flex-1 flex flex-col justify-center h-full group overflow-hidden min-h-0 min-w-0">
                    <VideoPlayer />
                </div>

                {/* Sidebar (Call + Chat) */}
                <div className={`${hasVideo ? 'w-64' : 'w-80'} flex flex-col gap-4 transition-all duration-500 min-w-0 max-w-sm sm:max-w-md shrink-0`}>
                    <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                        <CallWindow />
                    </div>
                    {/* Chat could go here */}
                </div>
            </main>
        </div>
    );
};

export default Room;
