import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { v4 as uuidv4 } from 'uuid';
import { Users, Play } from 'lucide-react';

const Home = () => {
    const [name, setName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const navigate = useNavigate();
    const { joinRoom } = useRoom();

    const handleCreateRoom = () => {
        if (!name) return alert('Please enter your name');
        const newRoomId = uuidv4().slice(0, 8);
        joinRoom(newRoomId, name);
        navigate(`/room/${newRoomId}`);
    };

    const handleJoinRoom = () => {
        if (!name || !roomIdInput) return alert('Please enter name and room ID');
        joinRoom(roomIdInput, name);
        navigate(`/room/${roomIdInput}`);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                        <Play size={32} className="ml-1" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        TogetherTime
                    </h1>
                    <p className="text-slate-400 mt-2">Watch videos in perfect sync with friends.</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={handleCreateRoom}
                            className="flex flex-col items-center justify-center p-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors group"
                        >
                            <Play size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                            <span className="font-medium">Create Room</span>
                        </button>

                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                placeholder="Room ID"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={handleJoinRoom}
                                className="flex items-center justify-center gap-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium"
                            >
                                <Users size={16} />
                                Join Existing
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
