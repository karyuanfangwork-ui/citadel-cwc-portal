import React, { useState, useCallback } from 'react';
import { adminService } from '../../services/admin.service';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ResetPasswordModalProps {
    user: { id: string; firstName: string; lastName: string; email: string };
    onClose: () => void;
    onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onSuccess }) => {
    const [phase, setPhase] = useState<'confirm' | 'result'>('confirm');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tempPassword, setTempPassword] = useState('');
    const [copied, setCopied] = useState(false);

    const focusTrapRef = useFocusTrap(true);
    const stableOnClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(stableOnClose);

    const handleReset = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await adminService.resetUserPassword(user.id);
            setTempPassword(result.tempPassword);
            setPhase('result');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div ref={focusTrapRef} className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" role="dialog" aria-modal="true" aria-label="Reset Password">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-amber-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-amber-600">key</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Reset Password</h2>
                            <p className="text-xs text-gray-500">{user.firstName} {user.lastName} ({user.email})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto">
                    {phase === 'confirm' ? (
                        <div>
                            <div className="p-5 space-y-4">
                                <p className="text-sm text-[#44546f]">
                                    This will generate a new temporary password for <strong>{user.firstName} {user.lastName}</strong>.
                                    Their current password and all active sessions will be invalidated.
                                </p>
                                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            </div>
                            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="button" onClick={handleReset} disabled={loading} className="px-4 py-2.5 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    <span className="text-sm font-bold">Password reset successfully</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">New Temporary Password</p>
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                                        <code className="flex-1 text-sm font-mono font-bold text-amber-800 break-all">{tempPassword}</code>
                                        <button type="button" onClick={handleCopy} className="text-amber-600 hover:text-amber-800 transition-colors flex-shrink-0" aria-label="Copy password">
                                            <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5">Share this with the user. They must change it after logging in.</p>
                                </div>
                            </div>
                            <div className="flex justify-end p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button type="button" onClick={() => { onSuccess(); onClose(); }} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3]">Done</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordModal;