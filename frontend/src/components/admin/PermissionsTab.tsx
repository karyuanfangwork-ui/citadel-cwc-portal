import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { adminService } from '../../services/admin.service';
import { hasPermission } from '../../utils/permissions';
import { useAuth } from '../../context/AuthContext';

interface Permission {
    id: string;
    name: string;
    resource: string;
    action: string;
    description: string | null;
    roles: { roleId: string }[];
}

interface Role {
    id: string;
    name: string;
    description: string | null;
}

type MatrixState = Record<string, Set<string>>; // roleId → Set<permissionId>

function groupByResource(permissions: Permission[]): Record<string, Permission[]> {
    return permissions.reduce<Record<string, Permission[]>>((acc, p) => {
        (acc[p.resource] = acc[p.resource] || []).push(p);
        return acc;
    }, {});
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
            {children}
        </div>,
        document.body
    );
}

export const PermissionsTab: React.FC = () => {
    const { user: authUser } = useAuth();
    const canAdminSettings = hasPermission(authUser, 'admin:settings');

    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [matrix, setMatrix] = useState<MatrixState>({});
    const [dirty, setDirty] = useState<Set<string>>(new Set()); // roleIds with unsaved changes
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    // ── Role CRUD modal state ──
    const [roleModal, setRoleModal] = useState<'create' | 'edit' | null>(null);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleForm, setRoleForm] = useState({ name: '', description: '' });
    const [roleSubmitting, setRoleSubmitting] = useState(false);

    // ── Delete confirm state ──
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'role' | 'permission'; id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Permission CRUD modal state ──
    const [permModal, setPermModal] = useState<boolean>(false);
    const [permForm, setPermForm] = useState({ name: '', resource: '', action: '', description: '' });
    const [permSubmitting, setPermSubmitting] = useState(false);

    // ── Filter state ──
    const [permSearch, setPermSearch] = useState('');
    const [hiddenRoles, setHiddenRoles] = useState<Set<string>>(new Set());

    const toggleRoleVisibility = (roleId: string) => {
        setHiddenRoles(prev => {
            const next = new Set(prev);
            if (next.has(roleId)) next.delete(roleId);
            else next.add(roleId);
            return next;
        });
    };

    // ── Auto-generate permission name from resource:action ──
    const handlePermFormChange = (field: string, value: string) => {
        const updated = { ...permForm, [field]: value };
        if (field === 'resource' || field === 'action') {
            updated.name = `${updated.resource}:${updated.action}`;
        }
        setPermForm(updated);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminService.listPermissions();
            setPermissions(data.permissions);
            setRoles(data.roles);
            const m: MatrixState = {};
            data.roles.forEach(r => { m[r.id] = new Set(); });
            data.permissions.forEach(p => {
                p.roles.forEach(rp => {
                    if (m[rp.roleId]) m[rp.roleId].add(p.id);
                });
            });
            setMatrix(m);
            setDirty(new Set());
        } catch {
            setError('Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Warn on navigation with unsaved changes ──
    useEffect(() => {
        if (dirty.size === 0) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty.size]);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    // ── Toggle permission in matrix ──
    const toggle = (roleId: string, permId: string) => {
        if (!canAdminSettings) return;
        setMatrix(prev => {
            const next = { ...prev, [roleId]: new Set(prev[roleId]) };
            if (next[roleId].has(permId)) next[roleId].delete(permId);
            else next[roleId].add(permId);
            return next;
        });
        setDirty(prev => new Set(prev).add(roleId));
    };

    // ── Bulk toggle all permissions for a role ──
    const toggleAllForRole = (roleId: string) => {
        if (!canAdminSettings) return;
        const allPermIds = permissions.map(p => p.id);
        setMatrix(prev => {
            const current = prev[roleId];
            const allGranted = allPermIds.every(id => current.has(id));
            const next = allGranted ? new Set<string>() : new Set<string>(allPermIds);
            return { ...prev, [roleId]: next };
        });
        setDirty(prev => new Set(prev).add(roleId));
    };

    // ── Bulk toggle a permission across all roles ──
    const toggleAllForPermission = (permId: string) => {
        if (!canAdminSettings) return;
        const allRoleIds = roles.map(r => r.id);
        const allGranted = allRoleIds.every(rId => matrix[rId]?.has(permId));
        setMatrix(prev => {
            const next = { ...prev };
            allRoleIds.forEach(rId => {
                next[rId] = new Set(next[rId]);
                if (allGranted) next[rId].delete(permId);
                else next[rId].add(permId);
            });
            return next;
        });
        setDirty(prev => new Set([...prev, ...allRoleIds]));
    };

    // ── Save role permissions ──
    const save = async (roleId: string) => {
        setSaving(prev => new Set(prev).add(roleId));
        try {
            await adminService.updateRolePermissions(roleId, Array.from(matrix[roleId]));
            setDirty(prev => { const n = new Set(prev); n.delete(roleId); return n; });
            showToast('success', 'Permissions saved');
        } catch {
            showToast('error', 'Failed to save permissions');
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(roleId); return n; });
        }
    };

    // ── Save all dirty roles in parallel ──
    const saveAll = async () => {
        await Promise.all(Array.from(dirty).map(roleId => save(roleId)));
    };

    // ── Create Role ──
    const handleCreateRole = async () => {
        if (!roleForm.name.trim()) return;
        setRoleSubmitting(true);
        try {
            const newRole = await adminService.createRole({
                name: roleForm.name.trim(),
                description: roleForm.description.trim() || undefined,
            });
            setRoles(prev => [...prev, newRole].sort((a, b) => a.name.localeCompare(b.name)));
            setMatrix(prev => ({ ...prev, [newRole.id]: new Set() }));
            setRoleModal(null);
            setRoleForm({ name: '', description: '' });
            showToast('success', `Role "${newRole.name}" created`);
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to create role';
            showToast('error', msg);
        } finally {
            setRoleSubmitting(false);
        }
    };

    // ── Update Role ──
    const handleUpdateRole = async () => {
        if (!editingRole || !roleForm.name.trim()) return;
        setRoleSubmitting(true);
        try {
            const updated = await adminService.updateRole(editingRole.id, {
                name: roleForm.name.trim(),
                description: roleForm.description.trim() || undefined,
            });
            setRoles(prev => prev.map(r => r.id === updated.id ? updated : r).sort((a, b) => a.name.localeCompare(b.name)));
            setRoleModal(null);
            setEditingRole(null);
            setRoleForm({ name: '', description: '' });
            showToast('success', `Role "${updated.name}" updated`);
            load();
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to update role';
            showToast('error', msg);
        } finally {
            setRoleSubmitting(false);
        }
    };

    // ── Delete Role ──
    const handleDeleteRole = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await adminService.deleteRole(deleteConfirm.id);
            setRoles(prev => prev.filter(r => r.id !== deleteConfirm.id));
            setMatrix(prev => {
                const next = { ...prev };
                delete next[deleteConfirm.id];
                return next;
            });
            setDirty(prev => { const n = new Set(prev); n.delete(deleteConfirm.id); return n; });
            showToast('success', `Role "${deleteConfirm.name}" deleted`);
            setDeleteConfirm(null);
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to delete role';
            showToast('error', msg);
        } finally {
            setDeleting(false);
        }
    };

    // ── Create Permission ──
    const handleCreatePermission = async () => {
        if (!permForm.resource.trim() || !permForm.action.trim()) return;
        setPermSubmitting(true);
        try {
            const newPerm = await adminService.createPermission({
                name: permForm.name.trim(),
                resource: permForm.resource.trim(),
                action: permForm.action.trim(),
                description: permForm.description.trim() || undefined,
            });
            setPermissions(prev => [...prev, { ...newPerm, roles: [] }].sort((a, b) => {
                if (a.resource !== b.resource) return a.resource.localeCompare(b.resource);
                return a.action.localeCompare(b.action);
            }));
            setPermModal(false);
            setPermForm({ name: '', resource: '', action: '', description: '' });
            showToast('success', `Permission "${newPerm.name}" created`);
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to create permission';
            showToast('error', msg);
        } finally {
            setPermSubmitting(false);
        }
    };

    // ── Delete Permission ──
    const handleDeletePermission = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await adminService.deletePermission(deleteConfirm.id);
            setPermissions(prev => prev.filter(p => p.id !== deleteConfirm.id));
            setMatrix(prev => {
                const next = { ...prev };
                for (const roleId of Object.keys(next)) {
                    next[roleId] = new Set(next[roleId]);
                    next[roleId].delete(deleteConfirm.id);
                }
                return next;
            });
            showToast('success', `Permission "${deleteConfirm.name}" deleted`);
            setDeleteConfirm(null);
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to delete permission';
            showToast('error', msg);
        } finally {
            setDeleting(false);
        }
    };

    const openEditRole = (role: Role) => {
        setEditingRole(role);
        setRoleForm({ name: role.name, description: role.description || '' });
        setRoleModal('edit');
    };

    const openCreateRole = () => {
        setEditingRole(null);
        setRoleForm({ name: '', description: '' });
        setRoleModal('create');
    };

    const openDeleteConfirm = (type: 'role' | 'permission', id: string, name: string) => {
        setDeleteConfirm({ type, id, name });
    };

    const visibleRoles = roles.filter(r => !hiddenRoles.has(r.id));
    const filteredPermissions = permSearch.trim()
        ? permissions.filter(p =>
            p.action.toLowerCase().includes(permSearch.toLowerCase()) ||
            p.resource.toLowerCase().includes(permSearch.toLowerCase()) ||
            (p.description ?? '').toLowerCase().includes(permSearch.toLowerCase())
          )
        : permissions;
    const grouped = groupByResource(filteredPermissions);
    const resources = Object.keys(grouped).sort();
    const dirtyCount = dirty.size;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-[#44546f]">
                <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                Loading permissions…
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        );
    }

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-[#101418] tracking-tight">Permission Matrix</h2>
                    <p className="text-sm text-[#44546f] mt-1">
                        Toggle permissions per role. Click <strong>Save</strong> after editing a column, or <strong>Save All</strong> for all changes.
                    </p>
                </div>
                {canAdminSettings && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {dirtyCount > 0 && (
                            <button
                                onClick={saveAll}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">save</span>
                                Save All ({dirtyCount})
                            </button>
                        )}
                        <button
                            onClick={openCreateRole}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#0052cc] text-white text-xs font-bold rounded-lg hover:bg-[#003d99] transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Add Role
                        </button>
                        <button
                            onClick={() => { setPermForm({ name: '', resource: '', action: '', description: '' }); setPermModal(true); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white text-[#0052cc] text-xs font-bold rounded-lg border border-[#0052cc] hover:bg-[#0052cc]/5 transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            Add Permission
                        </button>
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <span className="material-symbols-outlined text-base">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            {/* Unsaved changes banner */}
            {dirtyCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="material-symbols-outlined text-base">warning</span>
                    You have unsaved changes in {dirtyCount} role{dirtyCount > 1 ? 's' : ''}. Click <strong className="mx-1">Save All</strong> or save each column individually.
                </div>
            )}

            {/* Roles list bar */}
            <div className="bg-white rounded-xl border border-[#e8eaf0] p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#44546f] text-lg">shield</span>
                    <h3 className="text-sm font-black text-[#101418] uppercase tracking-wider">Roles ({roles.length})</h3>
                    <span className="text-xs text-[#8993a4]">— click a role to hide/show its column</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {roles.map(role => (
                        <div
                            key={role.id}
                            onClick={() => toggleRoleVisibility(role.id)}
                            title={role.description ? `${role.name}: ${role.description}` : 'Click to hide column'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer select-none ${
                                hiddenRoles.has(role.id)
                                    ? 'bg-white border-[#c1c7d0] text-[#8993a4] line-through opacity-50'
                                    : dirty.has(role.id)
                                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                                    : 'bg-[#f0f2f5] border-[#e8eaf0] text-[#101418]'
                            }`}
                        >
                            <span>{role.name}</span>
                            {canAdminSettings && !hiddenRoles.has(role.id) && (
                                <>
                                    <button
                                        onClick={e => { e.stopPropagation(); openEditRole(role); }}
                                        className="text-[#44546f] hover:text-[#0052cc] transition-colors"
                                        title="Edit role"
                                    >
                                        <span className="material-symbols-outlined text-xs">edit</span>
                                    </button>
                                    <button
                                        onClick={e => { e.stopPropagation(); openDeleteConfirm('role', role.id, role.name); }}
                                        className="text-[#44546f] hover:text-red-600 transition-colors"
                                        title="Delete role"
                                    >
                                        <span className="material-symbols-outlined text-xs">close</span>
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                {hiddenRoles.size > 0 && (
                    <button
                        onClick={() => setHiddenRoles(new Set())}
                        className="text-xs font-semibold text-[#0052cc] hover:underline"
                    >
                        Show all {hiddenRoles.size} hidden role{hiddenRoles.size > 1 ? 's' : ''}
                    </button>
                )}
            </div>

            {/* Search + column visibility */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44546f] text-base pointer-events-none">search</span>
                    <input
                        type="text"
                        value={permSearch}
                        onChange={e => setPermSearch(e.target.value)}
                        placeholder="Search permissions…"
                        className="w-full pl-9 pr-9 py-2 text-sm border border-[#e8eaf0] rounded-lg focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                    />
                    {permSearch && (
                        <button onClick={() => setPermSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#44546f] hover:text-[#101418]">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    )}
                </div>
                {permSearch && (
                    <span className="text-xs text-[#44546f]">
                        {filteredPermissions.length} result{filteredPermissions.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Permission Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-[#e8eaf0]">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-[#f7f8fa]">
                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#44546f] w-56 sticky left-0 bg-[#f7f8fa] z-30 border-r border-[#e8eaf0]">
                                Permission
                            </th>
                            {visibleRoles.map(role => (
                                <th key={role.id} className="px-4 py-4 text-center min-w-[100px] bg-[#f7f8fa]" title={role.description ?? undefined}>
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className="text-xs font-black uppercase tracking-widest text-[#101418]">{role.name}</span>
                                        {canAdminSettings && (
                                            <button
                                                onClick={() => toggleAllForRole(role.id)}
                                                className="text-[#8993a4] hover:text-[#0052cc] transition-colors"
                                                title={permissions.every(p => matrix[role.id]?.has(p.id)) ? 'Deselect all' : 'Select all'}
                                            >
                                                <span className="material-symbols-outlined text-sm">
                                                    {permissions.every(p => matrix[role.id]?.has(p.id)) ? 'remove_done' : 'done_all'}
                                                </span>
                                            </button>
                                        )}
                                        {dirty.has(role.id) && canAdminSettings && (
                                            <button
                                                onClick={() => save(role.id)}
                                                disabled={saving.has(role.id)}
                                                className="flex items-center gap-1 px-3 py-1 bg-[#0052cc] text-white text-xs font-bold rounded-full hover:bg-[#003d99] transition-colors disabled:opacity-50"
                                            >
                                                {saving.has(role.id)
                                                    ? <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                                                    : <span className="material-symbols-outlined text-xs">save</span>
                                                }
                                                Save
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {resources.length === 0 && permSearch && (
                            <tr>
                                <td colSpan={visibleRoles.length + 1} className="px-6 py-12 text-center text-sm text-[#44546f]">
                                    No permissions match "<strong>{permSearch}</strong>"
                                </td>
                            </tr>
                        )}
                        {resources.map(resource => (
                            <React.Fragment key={resource}>
                                <tr className="bg-[#f0f2f5]">
                                    <td
                                        colSpan={visibleRoles.length + 1}
                                        className="px-6 py-2 text-xs font-black uppercase tracking-widest text-[#44546f] sticky left-0 z-10 bg-[#f0f2f5]"
                                    >
                                        {resource}
                                    </td>
                                </tr>
                                {grouped[resource].map((perm, i) => (
                                    <tr
                                        key={perm.id}
                                        className={`border-t border-[#f0f2f5] hover:bg-[#f7f8fa] transition-colors ${i % 2 === 1 ? 'bg-white' : 'bg-[#fafbfc]'}`}
                                    >
                                        <td className="px-6 py-3 sticky left-0 bg-inherit border-r border-[#e8eaf0]">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-[#101418]">{perm.action}</div>
                                                    {perm.description && (
                                                        <div className="text-xs text-[#44546f] mt-0.5">{perm.description}</div>
                                                    )}
                                                </div>
                                                {canAdminSettings && (
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button
                                                            onClick={() => toggleAllForPermission(perm.id)}
                                                            className="text-[#8993a4] hover:text-[#0052cc] transition-colors"
                                                            title={roles.every(r => matrix[r.id]?.has(perm.id)) ? 'Remove from all roles' : 'Grant to all roles'}
                                                        >
                                                            <span className="material-symbols-outlined text-xs">
                                                                {roles.every(r => matrix[r.id]?.has(perm.id)) ? 'remove_done' : 'done_all'}
                                                            </span>
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteConfirm('permission', perm.id, perm.name)}
                                                            className="text-[#8993a4] hover:text-red-500 transition-colors"
                                                            title="Delete permission"
                                                        >
                                                            <span className="material-symbols-outlined text-xs">delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        {visibleRoles.map(role => {
                                            const checked = matrix[role.id]?.has(perm.id) ?? false;
                                            return (
                                                <td key={role.id} className={`px-4 py-3 text-center ${dirty.has(role.id) ? 'bg-amber-50/40' : ''}`}>
                                                    <button
                                                        onClick={() => toggle(role.id, perm.id)}
                                                        disabled={!canAdminSettings}
                                                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto border-2 transition-all ${
                                                            checked
                                                                ? 'bg-[#0052cc] border-[#0052cc] text-white'
                                                                : 'border-[#c1c7d0] bg-white hover:border-[#0052cc]'
                                                        } ${!canAdminSettings ? 'cursor-not-allowed opacity-50' : ''}`}
                                                        aria-label={`${checked ? 'Remove' : 'Add'} ${perm.name} for ${role.name}`}
                                                    >
                                                        {checked && (
                                                            <span className="material-symbols-outlined text-xs leading-none">check</span>
                                                        )}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-[#44546f]">
                Role names follow UPPERCASE_SNAKE_CASE convention. New roles appear as columns in the matrix — assign permissions by toggling cells.
            </p>

            {/* ── Create/Edit Role Modal ── */}
            {roleModal && (
                <Modal onClose={() => setRoleModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black text-[#101418]">
                            {roleModal === 'create' ? 'Create New Role' : 'Edit Role'}
                        </h3>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#44546f] mb-1.5">Role Name</label>
                            <input
                                type="text"
                                value={roleForm.name}
                                onChange={e => setRoleForm(prev => ({ ...prev, name: e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') }))}
                                placeholder="e.g. GROUP_DCEO"
                                className="w-full px-4 py-2.5 border border-[#e8eaf0] rounded-lg text-sm font-semibold text-[#101418] focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                maxLength={50}
                            />
                            <p className="text-xs text-[#8993a4] mt-1">Auto-formatted to UPPERCASE_SNAKE_CASE</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#44546f] mb-1.5">Description</label>
                            <input
                                type="text"
                                value={roleForm.description}
                                onChange={e => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional role description"
                                className="w-full px-4 py-2.5 border border-[#e8eaf0] rounded-lg text-sm text-[#101418] focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setRoleModal(null)}
                                className="px-4 py-2 text-sm font-semibold text-[#44546f] hover:text-[#101418] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={roleModal === 'create' ? handleCreateRole : handleUpdateRole}
                                disabled={roleSubmitting || !roleForm.name.trim()}
                                className="flex items-center gap-1.5 px-5 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#003d99] transition-colors disabled:opacity-50"
                            >
                                {roleSubmitting && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                                {roleModal === 'create' ? 'Create Role' : 'Update Role'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Create Permission Modal ── */}
            {permModal && (
                <Modal onClose={() => setPermModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black text-[#101418]">Create New Permission</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[#44546f] mb-1.5">Resource</label>
                                <input
                                    type="text"
                                    value={permForm.resource}
                                    onChange={e => handlePermFormChange('resource', e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
                                    placeholder="e.g. report"
                                    className="w-full px-4 py-2.5 border border-[#e8eaf0] rounded-lg text-sm font-semibold text-[#101418] focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                    maxLength={50}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[#44546f] mb-1.5">Action</label>
                                <input
                                    type="text"
                                    value={permForm.action}
                                    onChange={e => handlePermFormChange('action', e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
                                    placeholder="e.g. export"
                                    className="w-full px-4 py-2.5 border border-[#e8eaf0] rounded-lg text-sm font-semibold text-[#101418] focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                    maxLength={50}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#44546f] mb-1.5">Permission Name (auto-generated)</label>
                            <input
                                type="text"
                                value={permForm.name}
                                readOnly
                                className="w-full px-4 py-2.5 border border-[#e8eaf0] rounded-lg text-sm font-mono text-[#44546f] bg-[#f7f8fa] cursor-not-allowed"
                                placeholder="resource:action"
                            />
                            <p className="text-xs text-[#8993a4] mt-1">Format: resource:action</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#44546f] mb-1.5">Description</label>
                            <input
                                type="text"
                                value={permForm.description}
                                onChange={e => setPermForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional permission description"
                                className="w-full px-4 py-2.5 border border-[#e8eaf0] rounded-lg text-sm text-[#101418] focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setPermModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-[#44546f] hover:text-[#101418] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePermission}
                                disabled={permSubmitting || !permForm.resource.trim() || !permForm.action.trim()}
                                className="flex items-center gap-1.5 px-5 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#003d99] transition-colors disabled:opacity-50"
                            >
                                {permSubmitting && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                                Create Permission
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirm && (
                <Modal onClose={() => setDeleteConfirm(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-red-600">warning</span>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-[#101418]">
                                    Delete {deleteConfirm.type === 'role' ? 'Role' : 'Permission'}
                                </h3>
                                <p className="text-sm text-[#44546f] mt-0.5">
                                    Are you sure you want to delete <strong className="text-[#101418]">{deleteConfirm.name}</strong>?
                                </p>
                            </div>
                        </div>
                        {deleteConfirm.type === 'role' && (
                            <p className="text-xs text-[#8993a4] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                This will fail if any users are still assigned to this role. Remove the role from users first.
                            </p>
                        )}
                        {deleteConfirm.type === 'permission' && (
                            <p className="text-xs text-[#8993a4] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                This will remove the permission from all roles that currently have it.
                            </p>
                        )}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm font-semibold text-[#44546f] hover:text-[#101418] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteConfirm.type === 'role' ? handleDeleteRole : handleDeletePermission}
                                disabled={deleting}
                                className="flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleting && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                                Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
