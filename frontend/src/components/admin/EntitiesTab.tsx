import React, { useState } from 'react';
import { Entity, entityService } from '../../services/entity.service';

interface EntitiesTabProps {
    entities: Entity[];
    users: { id: string; firstName: string; lastName: string; email: string }[];
    onRefresh: () => void;
}

export const EntitiesTab: React.FC<EntitiesTabProps> = ({ entities, users, onRefresh }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
    const [form, setForm] = useState({ name: '', code: '', description: '', approverId: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openCreate = () => {
        setForm({ name: '', code: '', description: '', approverId: '' });
        setError(null);
        setShowCreateModal(true);
        setEditingEntity(null);
    };

    const openEdit = (entity: Entity) => {
        setForm({
            name: entity.name,
            code: entity.code,
            description: entity.description || '',
            approverId: entity.approverId,
        });
        setError(null);
        setEditingEntity(entity);
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.code || !form.approverId) {
            setError('Name, code, and approver are required.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (editingEntity) {
                await entityService.updateEntity(editingEntity.id, form);
            } else {
                await entityService.createEntity(form);
            }
            setShowCreateModal(false);
            onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save entity.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (entity: Entity) => {
        await entityService.updateEntity(entity.id, { isActive: !entity.isActive });
        onRefresh();
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/20">
                <div>
                    <h3 className="font-black text-[#101418]">Subsidiary Entities</h3>
                    <p className="text-xs text-[#44546f] mt-0.5">Each entity has one designated approver for ticket routing.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-3 bg-[#0052cc] text-white text-sm font-bold rounded-2xl hover:bg-[#0047b3] transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Entity
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr className="text-[11px] font-black text-[#44546f] uppercase tracking-[0.2em]">
                            <th className="px-8 py-5">Name</th>
                            <th className="px-8 py-5">Code</th>
                            <th className="px-8 py-5">Designated Approver</th>
                            <th className="px-8 py-5">Status</th>
                            <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {entities.map((entity) => (
                            <tr key={entity.id} className={`hover:bg-gray-50/50 transition-colors ${!entity.isActive ? 'opacity-50' : ''}`}>
                                <td className="px-8 py-5 font-bold text-[#101418]">
                                    <div>{entity.name}</div>
                                    {entity.description && <div className="text-xs text-[#44546f] mt-0.5">{entity.description}</div>}
                                </td>
                                <td className="px-8 py-5">
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-black rounded-lg font-mono">{entity.code}</span>
                                </td>
                                <td className="px-8 py-5 text-sm text-[#44546f]">
                                    <div className="font-semibold text-[#101418]">{entity.approver.firstName} {entity.approver.lastName}</div>
                                    <div className="text-xs">{entity.approver.email}</div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${entity.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                        {entity.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => openEdit(entity)}
                                            className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                            title="Edit entity"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeactivate(entity)}
                                            className={`w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 ${entity.isActive ? 'text-[#44546f] hover:text-red-600' : 'text-[#44546f] hover:text-emerald-600'}`}
                                            title={entity.isActive ? 'Deactivate' : 'Activate'}
                                        >
                                            <span className="material-symbols-outlined text-xl">{entity.isActive ? 'block' : 'check_circle'}</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {entities.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-8 py-16 text-center text-[#44546f] font-bold">No entities configured yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
                            <h2 className="text-lg font-bold text-gray-900">{editingEntity ? 'Edit Entity' : 'Add Entity'}</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Entity Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="e.g. Citadel Malaysia"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Entity Code *</label>
                                <input
                                    type="text"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                                    placeholder="e.g. CIT-MY"
                                />
                                <p className="text-xs text-gray-500 mt-1">Used as the value in custom fields (auto-uppercased)</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="Optional description"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Designated Approver *</label>
                                <select
                                    value={form.approverId}
                                    onChange={(e) => setForm({ ...form, approverId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">Select approver...</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingEntity ? 'Save Changes' : 'Create Entity'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};