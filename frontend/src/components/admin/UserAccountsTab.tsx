import React from 'react';

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
    onEditUser: (user: any) => void;
    onManageRoles: (user: any) => void;
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
    onEditUser,
    onManageRoles,
    onToggleUserStatus,
}) => {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Header / Filters */}
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row gap-4 bg-gray-50/20">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none"
                        value={userSearch}
                        onChange={e => onSearch(e.target.value)}
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
            </div>

            {/* Table */}
            {usersLoading ? (
                <div className="p-16 text-center text-[#44546f] font-bold">Loading users...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-[11px] font-black text-[#44546f] uppercase tracking-[0.2em]">
                                <th className="px-8 py-5">User</th>
                                <th className="px-8 py-5">Department</th>
                                <th className="px-8 py-5">Entity</th>
                                <th className="px-8 py-5">Roles</th>
                                <th className="px-8 py-5">Agent Team</th>
                                <th className="px-8 py-5">Status</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(user => (
                                <tr key={user.id} className={`hover:bg-gray-50/50 transition-colors ${!user.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-8 py-5">
                                        <div className="font-bold text-[#101418]">{user.firstName} {user.lastName}</div>
                                        <div className="text-sm text-[#44546f]">{user.email}</div>
                                    </td>
                                    <td className="px-8 py-5 text-sm text-[#44546f]">{user.department || '—'}</td>
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
                                            >
                                                <span className="material-symbols-outlined text-xl">edit</span>
                                            </button>
                                            <button
                                                onClick={() => onManageRoles(user)}
                                                className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Manage roles"
                                            >
                                                <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                                            </button>
                                            {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && (
                                                <button
                                                    onClick={() => onManageRoles(user)}
                                                    className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                    title="Assign agent team (IT/HR)"
                                                >
                                                    <span className="material-symbols-outlined text-xl">groups</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onToggleUserStatus(user)}
                                                className={`w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100 ${user.isActive ? 'text-[#44546f] hover:text-red-600' : 'text-[#44546f] hover:text-emerald-600'}`}
                                                title={user.isActive ? 'Disable account' : 'Enable account'}
                                            >
                                                <span className="material-symbols-outlined text-xl">{user.isActive ? 'block' : 'check_circle'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-8 py-16 text-center text-[#44546f] font-bold">No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

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
