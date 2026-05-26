import React, { useEffect, useState } from 'react';
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
    userStatusFilter: '' | 'active' | 'disabled';
    userStats: { total: number; active: number; disabled: number; agents: number };
    availableRoles: { id: string; name: string; description: string }[];
    entities?: { id: string; name: string; code: string }[];
    approverEntityMap?: Record<string, string>;
    onSearch: (value: string) => void;
    onRoleFilter: (value: string) => void;
    onStatusFilter: (value: '' | 'active' | 'disabled') => void;
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
    userStatusFilter,
    userStats,
    availableRoles,
    entities,
    approverEntityMap,
    onSearch,
    onRoleFilter,
    onStatusFilter,
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
    }, [debouncedSearch, userSearch, onSearch]);

    useEffect(() => {
        setSearchInput(userSearch);
    }, [userSearch]);

    const stats = {
        total: userStats.total,
        active: userStats.active,
        disabled: userStats.disabled,
        agents: userStats.agents,
    };

    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Sub-header with Import Staff */}
            <div className="px-8 pt-6 pb-0 flex justify-end">
                <button
                    onClick={onImportStaff}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-[#44546f] text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    Import Staff
                </button>
            </div>

            {/* Header / Filters */}
            <div className="px-8 pb-6 border-b border-gray-100 flex flex-col md:flex-row gap-4">
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
                <div className="relative">
                    <select
                        className={`pl-4 pr-10 py-3 bg-white border rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none appearance-none ${userRoleFilter ? 'border-[#0052cc] text-[#0052cc]' : 'border-gray-200'}`}
                        value={userRoleFilter}
                        onChange={e => onRoleFilter(e.target.value)}
                    >
                        <option value="">All Roles</option>
                        {availableRoles.map(r => (
                            <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                    </select>
                    {userRoleFilter && (
                        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#0052cc]" />
                    )}
                </div>
                <div className="flex items-center rounded-2xl border border-gray-200 bg-white overflow-hidden text-sm font-bold">
                    {([['', 'All'], ['active', 'Active'], ['disabled', 'Disabled']] as const).map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => onStatusFilter(val)}
                            className={`px-3 py-3 transition-colors whitespace-nowrap ${
                                userStatusFilter === val
                                    ? 'bg-[#0052cc] text-white'
                                    : 'text-[#44546f] hover:bg-gray-50'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onCreateUser}
                    className="flex items-center gap-2 px-4 py-3 bg-[#0052cc] text-white text-sm font-bold rounded-2xl hover:bg-[#0047b3] transition-colors whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    Create User
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
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
                                        <div className="font-bold text-[#101418]">{user.firstName} {user.lastName}</div>
                                        <div className="text-sm text-[#44546f]">{user.email}</div>
                                    </td>
                                    <td className={`px-8 py-5 text-sm text-[#44546f] ${!user.isActive ? 'opacity-50' : ''}`}>
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
                                    <td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles?.map((ur: any) => (
                                                <span key={ur.role?.name || ur} className="px-2 py-0.5 bg-blue-50 text-[#0052cc] text-[10px] font-black uppercase rounded-full border border-blue-100">
                                                    {ur.role?.name || ur}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
                                        {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') ? (
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.agentTeam ? `bg-amber-50 text-amber-600 border-amber-100` : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                                {user.agentTeam || 'Unassigned'}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className={`px-8 py-5 ${!user.isActive ? 'opacity-50' : ''}`}>
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                            {user.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            {/* Safe actions */}
                                            <button
                                                onClick={() => onEditUser(user)}
                                                className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Edit user details"
                                                aria-label={`Edit ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => onManageRoles(user)}
                                                className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Manage roles"
                                                aria-label={`Manage roles for ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                                            </button>
                                            <button
                                                onClick={() => onResetPassword(user)}
                                                className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Reset password"
                                                aria-label={`Reset password for ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-lg">key</span>
                                            </button>
                                            {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && (
                                                <button
                                                    onClick={() => onAssignAgentTeam(user)}
                                                    className="w-9 h-9 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                    title="Assign agent team"
                                                    aria-label={`Assign agent team for ${user.firstName} ${user.lastName}`}
                                                >
                                                    <span className="material-symbols-outlined text-lg">groups</span>
                                                </button>
                                            )}
                                            {/* Divider */}
                                            <div className="w-px h-6 bg-gray-200 mx-1" />
                                            {/* Destructive action */}
                                            <button
                                                onClick={() => onToggleUserStatus(user)}
                                                className={`w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 ${user.isActive ? 'text-[#44546f] hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'}`}
                                                title={user.isActive ? 'Disable account' : 'Enable account'}
                                                aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.firstName} ${user.lastName}`}
                                            >
                                                <span className="material-symbols-outlined text-lg">{user.isActive ? 'block' : 'check_circle'}</span>
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
                                                    {userSearch || userRoleFilter || userStatusFilter ? 'No users match your filters' : 'No users yet'}
                                                </p>
                                                <p className="text-xs text-[#44546f] mt-1">
                                                    {userSearch || userRoleFilter || userStatusFilter
                                                        ? 'Try adjusting your search or filters.'
                                                        : 'Create your first user to get started.'}
                                                </p>
                                            </div>
                                            {!userSearch && !userRoleFilter && !userStatusFilter && (
                                                <div className="mt-1 flex items-center gap-2">
                                                    <button
                                                        onClick={onCreateUser}
                                                        className="flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-xl hover:bg-[#0047b3] transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">person_add</span>
                                                        Create User
                                                    </button>
                                                    <button
                                                        onClick={onImportStaff}
                                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#0052cc] text-sm font-bold rounded-xl hover:bg-blue-50 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">upload_file</span>
                                                        Import Staff
                                                    </button>
                                                </div>
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
