import React, { useState, useCallback, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Entity {
    id: string;
    name: string;
    code: string;
}

interface CreateUserModalProps {
    onSuccess: () => void;
    onClose: () => void;
    entities?: Entity[];
}

const EXECUTIVE_ROLES = [
    { value: '', label: 'None' },
    { value: 'GROUP_CEO', label: 'Group CEO' },
    { value: 'CEO', label: 'CEO' },
    { value: 'CTO', label: 'CTO' },
    { value: 'CFO', label: 'CFO' },
    { value: 'CMO', label: 'CMO' },
    { value: 'COO', label: 'COO' },
    { value: 'CHRO', label: 'CHRO' },
];

const CreateUserModal: React.FC<CreateUserModalProps> = ({ onSuccess, onClose, entities = [] }) => {
    const focusTrapRef = useFocusTrap(true);
    const stableOnClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(stableOnClose);
    const [phase, setPhase] = useState<'form' | 'success'>('form');
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        department: '',
        jobTitle: '',
        entityId: '',
        executiveRole: '',
    });
    const [tempPassword, setTempPassword] = useState('');
    const [createdUser, setCreatedUser] = useState<{ firstName: string; lastName: string; email: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
            setError('First name, last name, and email are required.');
            return;
        }
        try {
            setSubmitting(true);
            const payload: { firstName: string; lastName: string; email: string; department?: string; jobTitle?: string; entityId?: string; executiveRole?: string } = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
            };
            if (form.department.trim()) payload.department = form.department.trim();
            if (form.jobTitle.trim()) payload.jobTitle = form.jobTitle.trim();
            if (form.entityId) payload.entityId = form.entityId;
            if (form.executiveRole) payload.executiveRole = form.executiveRole;

            const res = await adminService.createUser(payload);
            setCreatedUser(res.user);
            setTempPassword(res.tempPassword);
            setPhase('success');
        } catch (err: any) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create user.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDone = () => {
        onSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Create User">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#0052cc]">person_add</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Create User</h2>
                            <p className="text-xs text-gray-500">New account · NORMAL_STAFF role · Temp password</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto">
                    {phase === 'form' ? (
                        <form onSubmit={handleSubmit}>
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                            First Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="firstName"
                                            value={form.firstName}
                                            onChange={handleChange}
                                            placeholder="John"
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                            Last Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="lastName"
                                            value={form.lastName}
                                            onChange={handleChange}
                                            placeholder="Doe"
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="john.doe@test.local"
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                        Job Title
                                    </label>
                                    <input
                                        name="jobTitle"
                                        value={form.jobTitle}
                                        onChange={handleChange}
                                        placeholder="e.g., Full Stack Developer"
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                        Department
                                    </label>
                                    <input
                                        name="department"
                                        value={form.department}
                                        onChange={handleChange}
                                        placeholder="e.g., IT, HR, Finance"
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                                    />
                                </div>
                                {entities.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                            Entity (Subsidiary)
                                        </label>
                                        <select
                                            name="entityId"
                                            value={form.entityId}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] bg-white"
                                        >
                                            <option value="">None</option>
                                            {entities.map(entity => (
                                                <option key={entity.id} value={entity.id}>
                                                    {entity.name} ({entity.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                        Executive Role
                                    </label>
                                    <select
                                        name="executiveRole"
                                        value={form.executiveRole}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] bg-white"
                                    >
                                        {EXECUTIVE_ROLES.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Assign C-level executive role for high-value approval workflows
                                    </p>
                                </div>
                                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            </div>
                            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3] disabled:opacity-50">
                                    {submitting ? 'Creating…' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            <div className="p-5 space-y-4">
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    <span className="text-sm font-bold">User created successfully</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Account</p>
                                    <p className="text-sm font-bold text-gray-900">{createdUser?.firstName} {createdUser?.lastName}</p>
                                    <p className="text-sm text-gray-500">{createdUser?.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Temporary Password</p>
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                                        <code className="flex-1 text-sm font-mono font-bold text-amber-800">{tempPassword}</code>
                                        <button type="button" onClick={handleCopy} className="text-amber-600 hover:text-amber-800 transition-colors">
                                            <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5">Share this with the user. They can change it after logging in.</p>
                                </div>
                            </div>
                            <div className="flex justify-end p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                                <button type="button" onClick={handleDone} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3]">
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateUserModal;