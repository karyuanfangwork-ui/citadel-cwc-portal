import React, { useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

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
    const focusTrapRef = useFocusTrap(true);
    const stableOnClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(stableOnClose);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Assign Agent Team">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#0052cc]">groups</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Assign Agent Team</h2>
                            <p className="text-xs text-gray-500">{user.firstName} {user.lastName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>
                <div className="p-5 overflow-y-auto">
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
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button
                        onClick={onAssign}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                    >Assign Team</button>
                </div>
            </div>
        </div>
    );
};