import React, { useEffect, useState, useMemo } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface UserPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface UserAccountsTabProps {
    users: any[];
    usersLoading: boolean;
    userPagination: UserPagination;
    userSearch: string;
    userRoleFilter: string;
    availableRoles: { id: string; name: string; description: string }[];
    entities?: { id: string; name: string; code: string }[];
    approverEntityMap?: Record<string, string>;
    onSearch: (value: string) => void;
    onRoleFilter: (value: string) => void;
    onFetchUsers: (page: number) => void;
    onCreateUser: () => void;
    onImportStaff: () => void;
    onEditUser: (user: any) => void;
    onManageRoles: (user: any) => void;
    onResetPassword: (user: any) => void;
    onAssignAgentTeam: (user: any) => void;
    onToggleUserStatus: (user: any) => void;
}

export const UserAccountsTab: React.FC<UserAccountsTabProps> = ({
    users,
    usersLoading,
    userPagination,
    userSearch,
    userRoleFilter,
    availableRoles,
    entities,
    approverEntityMap,
    onSearch,
    onRoleFilter,
    onFetchUsers,
    onCreateUser,
    onImportStaff,
    onEditUser,
    onManageRoles,
    onResetPassword,
    onAssignAgentTeam,
    onToggleUserStatus,
}) => {
    const [searchInput, setSearchInput] = useState(userSearch);
    const debouncedSearch = useDebouncedValue(searchInput, 300);

    useEffect(() => {
        if (debouncedSearch !== userSearch) {
            onSearch(debouncedSearch);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        setSearchInput(userSearch);
    }, [userSearch]);

    const stats = useMemo(() => {
        const total = userPagination.total;
        const active = users.filter(u => u.isActive).length;
        const disabled = users.filter(u => !u.isActive).length;
        const agents = users.filter(u => u.roles?.some((ur: any) => ur.role?.name === 'AGENT')).length;
        return { total, active, disabled, agents };
    }, [users, userPagination.total]);

    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Header / Filters */}
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row gap-4 bg-gray-50/20">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="Search by name, email, entity..."
                        className="w-full pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                    />
                </div>
                <select
                    className="pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none appearance-none"
                    value={userRoleFilter}
                    onChange={e => onRoleFilter(e.target.value)}
                >
                    <option value="">All Roles</option>
                    {availableRoles.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                </select>
                <button
                    onClick={onCreateUser}
                    className="flex items-center gap-2 px-4 py-3 bg-[#0052cc] text-white text-sm font-bold rounded-2xl hover:bg-[#0047b3] transition-colors whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    Create User
                </button>
                <button
                    onClick={onImportStaff}
                    className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-[#0052cc] text-sm font-bold rounded-2xl hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    Import Staff
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-8 pb-4">
                {[
                    { label: 'Total Users', value: stats.total, icon: 'group', color: 'bg-blue-50 text-blue-600' },
                    { label: 'Active', value: stats.active, icon: 'check_circle', color: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Disabled', value: stats.disabled, icon: 'block', color: 'bg-gray-100 text-gray-500' },
                    { label: 'Agents', value: stats.agents, icon: 'support_agent', color: 'bg-amber-50 text-amber-600' },
                ].map(card => (
                    <div key={card.label} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                            <span className="material-symbols-outlined text-lg">{card.icon}</span>
                        </div>
                        <div>
                            <p className="text-xl font-black text-[#101418] leading-tight">{card.value}</p>
                            <p className="text-[10px] font-bold text-[#44546f] uppercase tracking-wider">{card.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left" role="table" aria-label="User accounts">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr className="text-[11px] font-black text-[#44546f] uppercase tracking-[0.2em]">
                            <th className="px-8 py-5">User</th>
                            <th className="px-8 py-5">Entity</th>
                            <th className="px-8 py-5">Roles</th>
                            <th className="px-8 py-5">Agent Team</th>
                            <th className="px-8 py-5">Status</th>
                            <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    {usersLoading ? (
                        <tbody className="divide-y divide-gray-100" role="status" aria-label="Loading users">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded-lg w-32" /></td>
                                    <td className="px-8 py-5"><div className="h-4 bg-gray-200 rounded-lg w-20" /></td>
                                    <td className="px-8 py-5"><div className="flex gap-1"><div className="h-5 bg-gray-200 rounded-full w-14" /><div className="h-5 bg-gray-200 rounded-full w-10" /></div></td>
                                    <td className="px-8 py-5"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
                                    <td className="px-8 py-5"><div className="h-5 bg-gray-200 rounded-full w-14" /></td>
                                    <td className="px-8 py-5"><div className="flex gap-2 justify-end"><div className="h-10 w-10 bg-gray-200 rounded-xl" /><div className="h-10 w-10 bg-gray-200 rounded-xl" /></div></td>
                                </tr>
                            ))}
                        </tbody>
                    ) : (
                    <tbody className="divide-y divide-gray-100">
                            {users.map(user => (
                                <tr key={user.id} className={`hover:bg-gray-50/50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-[#101418]">{user.firstName} {user.lastName}</div>
                                        <div className="text-sm text-[#44546f]">{user.email}</div>
                                    </td>
                                    <td className="px-8 py-5 text-sm text-[#44546f]">
                                        {(() => {
                                            const entityName = entities?.find(e => e.id === user.entityId)?.name;
                                            const approverFor = approverEntityMap?.[user.id];
                                            return (
                                                <div className="space-y-1">
                                                    <div>{entityName || '—'}</div>
                                                    {approverFor && (
                                                        <span className="inline-flex px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-black uppercase rounded-full border border-violet-100">
                                                            Approver: {approverFor}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles?.map((ur: any) => (
                                                <span key={ur.role?.name || ur} className="px-2 py-0.5 bg-blue-50 text-[#0052cc] text-[10px] font-black uppercase rounded-full border border-blue-100">
                                                    {ur.role?.name || ur}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') ? (
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.agentTeam ? `bg-amber-50 text-amber-600 border-amber-100` : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                                {user.agentTeam || 'Unassigned'}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                            {user.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => onEditUser(user)}
                                                className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Edit user details"
                                                aria-label={`Edit ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-xl">edit</span>
                                            </button>
                                            <button
                                                onClick={() => onManageRoles(user)}
                                                className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Manage roles"
                                                aria-label={`Manage roles for ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                                            </button>
                                            <button
                                                onClick={() => onResetPassword(user)}
                                                className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Reset password"
                                                aria-label={`Reset password for ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-xl">key</span>
                                            </button>
                                            {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && (
                                                <button
                                                    onClick={() => onAssignAgentTeam(user)}
                                                    className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                    title="Assign agent team (IT/HR)"
                                                    aria-label={`Assign agent team for ${user.firstName} ${user.lastName}`}
                                                >
                                                    <span className="material-symbols-outlined text-xl">groups</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onToggleUserStatus(user)}
                                                className={`w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 ${user.isActive ? 'text-[#44546f] hover:text-red-600' : 'text-[#44546f] hover:text-emerald-600'}`}
                                                title={user.isActive ? 'Disable account' : 'Enable account'}
                                                aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-xl">{user.isActive ? 'block' : 'check_circle'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center" role="status">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-3xl text-gray-400">person_off</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[#101418]">
                                                    {userSearch || userRoleFilter ? 'No users match your filters' : 'No users yet'}
                                                </p>
                                                <p className="text-xs text-[#44546f] mt-1">
                                                    {userSearch || userRoleFilter
                                                        ? 'Try adjusting your search or role filter.'
                                                        : 'Create your first user to get started.'}
                                                </p>
                                            </div>
                                            {!userSearch && !userRoleFilter && (
                                                <button
                                                    onClick={onCreateUser}
                                                    className="mt-1 flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-xl hover:bg-[#0047b3] transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-sm">person_add</span>
                                                    Create User
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    )}
                </table>
            </div>

            {/* Pagination */}
            {userPagination.totalPages > 1 && (
                <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-[#44546f] font-medium">
                        Showing {(userPagination.page - 1) * userPagination.limit + 1}–{Math.min(userPagination.page * userPagination.limit, userPagination.total)} of {userPagination.total} users
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onFetchUsers(userPagination.page - 1)}
                            disabled={userPagination.page <= 1}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-[#44546f] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >Previous</button>
                        <button
                            onClick={() => onFetchUsers(userPagination.page + 1)}
                            disabled={userPagination.page >= userPagination.totalPages}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-[#44546f] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >Next</button>
                    </div>
                </div>
            )}
        </div>
    );
};
