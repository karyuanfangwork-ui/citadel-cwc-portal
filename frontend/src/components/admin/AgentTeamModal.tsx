import React from 'react';

interface AgentTeamModalProps {
    isOpen: boolean;
    user: any;
    selectedTeam: string;
    onTeamChange: (team: string) => void;
    onAssign: () => void;
    onClose: () => void;
}

export const AgentTeamModal: React.FC<AgentTeamModalProps> = ({
    isOpen,
    user,
    selectedTeam,
    onTeamChange,
    onAssign,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden scale-in flex flex-col max-h-[90vh]">
                <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-[#101418]">Assign Agent Team</h2>
                        <p className="text-sm text-[#44546f] mt-1">{user.firstName} {user.lastName}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>
                </div>
                <div className="p-10 overflow-y-auto">
                    <p className="text-xs font-black text-[#44546f] uppercase tracking-widest mb-6">Select the team this agent manages</p>
                    <div className="space-y-3">
                        {['IT', 'HR', 'Finance'].map(team => (
                            <label key={team} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-amber-600/30 hover:bg-amber-50/20 cursor-pointer transition-all">
                                <input
                                    type="radio"
                                    name="agentTeam"
                                    value={team}
                                    checked={selectedTeam === team}
                                    onChange={e => onTeamChange(e.target.value)}
                                    className="w-5 h-5 accent-amber-600"
                                />
                                <div>
                                    <div className="font-bold text-[#101418] text-sm">{team} Team</div>
                                    <div className="text-xs text-[#44546f]">
                                        {team === 'IT' ? 'Can manage IT infrastructure tasks' : team === 'HR' ? 'Can manage HR, Admin, and Training tasks' : 'Can manage Finance and procurement tasks'}
                                    </div>
                                </div>
                            </label>
                        ))}
                        <label className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all">
                            <input
                                type="radio"
                                name="agentTeam"
                                value=""
                                checked={selectedTeam === ''}
                                onChange={e => onTeamChange('')}
                                className="w-5 h-5 accent-gray-400"
                            />
                            <div>
                                <div className="font-bold text-[#101418] text-sm">No Team Assignment</div>
                                <div className="text-xs text-[#44546f]">Agent has no task restrictions (admin override)</div>
                            </div>
                        </label>
                    </div>
                    <div className="flex gap-4 mt-8">
                        <button onClick={onClose} className="flex-1 py-4 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">Cancel</button>
                        <button
                            onClick={onAssign}
                            className="flex-1 py-4 bg-amber-600 text-white font-black rounded-3xl hover:bg-amber-700 transition-all text-xs uppercase tracking-widest"
                        >Assign Team</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
