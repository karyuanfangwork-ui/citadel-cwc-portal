import React, { useEffect, useState, useCallback } from 'react';
import { adminService } from '../../services/admin.service';

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

export const PermissionsTab: React.FC = () => {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [matrix, setMatrix] = useState<MatrixState>({});
    const [dirty, setDirty] = useState<Set<string>>(new Set()); // roleIds with unsaved changes
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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

    const toggle = (roleId: string, permId: string) => {
        setMatrix(prev => {
            const next = { ...prev, [roleId]: new Set(prev[roleId]) };
            if (next[roleId].has(permId)) next[roleId].delete(permId);
            else next[roleId].add(permId);
            return next;
        });
        setDirty(prev => new Set(prev).add(roleId));
    };

    const save = async (roleId: string) => {
        setSaving(prev => new Set(prev).add(roleId));
        try {
            await adminService.updateRolePermissions(roleId, Array.from(matrix[roleId]));
            setDirty(prev => { const n = new Set(prev); n.delete(roleId); return n; });
            setToast({ type: 'success', msg: 'Permissions saved' });
        } catch {
            setToast({ type: 'error', msg: 'Failed to save permissions' });
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(roleId); return n; });
        }
        setTimeout(() => setToast(null), 3000);
    };

    const grouped = groupByResource(permissions);
    const resources = Object.keys(grouped).sort();

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
            <div>
                <h2 className="text-xl font-black text-[#101418] tracking-tight">Permission Matrix</h2>
                <p className="text-sm text-[#44546f] mt-1">
                    Toggle which permissions each role holds. Changes are per-role — click <strong>Save</strong> after editing a column.
                </p>
            </div>

            {toast && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <span className="material-symbols-outlined text-base">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-[#e8eaf0]">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#f7f8fa]">
                            <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#44546f] w-56 sticky left-0 bg-[#f7f8fa] z-10 border-r border-[#e8eaf0]">
                                Permission
                            </th>
                            {roles.map(role => (
                                <th key={role.id} className="px-4 py-4 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-[#101418]">{role.name}</span>
                                        {dirty.has(role.id) && (
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
                        {resources.map(resource => (
                            <React.Fragment key={resource}>
                                <tr className="bg-[#f0f2f5]">
                                    <td
                                        colSpan={roles.length + 1}
                                        className="px-6 py-2 text-xs font-black uppercase tracking-widest text-[#44546f] sticky left-0"
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
                                            <div className="text-sm font-semibold text-[#101418]">{perm.action}</div>
                                            {perm.description && (
                                                <div className="text-xs text-[#44546f] mt-0.5">{perm.description}</div>
                                            )}
                                        </td>
                                        {roles.map(role => {
                                            const checked = matrix[role.id]?.has(perm.id) ?? false;
                                            return (
                                                <td key={role.id} className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => toggle(role.id, perm.id)}
                                                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto border-2 transition-all ${
                                                            checked
                                                                ? 'bg-[#0052cc] border-[#0052cc] text-white'
                                                                : 'border-[#c1c7d0] bg-white hover:border-[#0052cc]'
                                                        }`}
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
                Note: Permission checks are advisory — controllers enforce access using role-based authorization. This matrix documents intended access and can inform future controller-level enforcement.
            </p>
        </div>
    );
};
