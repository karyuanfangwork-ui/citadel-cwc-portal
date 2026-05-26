import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import Breadcrumbs from '../src/components/Breadcrumbs';

import CreateUserModal from '../src/components/admin/CreateUserModal';
import ImportStaffModal from '../src/components/admin/ImportStaffModal';
import UserEditModal from '../src/components/admin/UserEditModal';
import { StatusDefinitionsTab } from '../src/components/admin/StatusDefinitionsTab';
import { WorkflowTransitionTab } from '../src/components/admin/WorkflowTransitionTab';
import { BannerConfigTab } from '../src/components/admin/BannerConfigTab';
import { EmailNotificationsTab } from '../src/components/admin/EmailNotificationsTab';
import { PermissionsTab } from '../src/components/admin/PermissionsTab';
import { EntitiesTab } from '../src/components/admin/EntitiesTab';
import { AuditLogTab } from '../src/components/admin/AuditLogTab';
import { SLAEscalationTab } from '../src/components/admin/SLAEscalationTab';
import SchedulerSettings from '../src/components/admin/SchedulerSettings';
import { useAdminState } from '../src/components/admin/useAdminState';
import { ADMIN_TABS, CATEGORY_ICONS, COLOR_THEMES } from '../src/components/admin/adminConstants';
import { ServiceDesksTab } from '../src/components/admin/ServiceDesksTab';
import { ServiceDeskModal } from '../src/components/admin/ServiceDeskModal';
import { UserAccountsTab } from '../src/components/admin/UserAccountsTab';
import { OnboardingTasksTab } from '../src/components/admin/OnboardingTasksTab';
import { OffboardingTasksTab } from '../src/components/admin/OffboardingTasksTab';
import { CategoryModal } from '../src/components/admin/CategoryModal';
import { ServiceModal } from '../src/components/admin/ServiceModal';
import { RoleAssignmentModal } from '../src/components/admin/RoleAssignmentModal';
import { AgentTeamModal } from '../src/components/admin/AgentTeamModal';
import { ResetPasswordModal } from '../src/components/admin';
import { RequestTypeEditModal } from '../src/components/admin/RequestTypeEditModal';
import { FormBuilderModal } from '../src/components/admin/FormBuilderModal';
import { entityService, Entity } from '../src/services/entity.service';

const AdminSettings = () => {
    const { logout } = useAuth();
    const admin = useAdminState();
    const [searchParams, setSearchParams] = useSearchParams();

    // ── Sync tab from URL on mount ──
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        if (tabFromUrl && ADMIN_TABS.some(t => t.id === tabFromUrl)) {
            admin.setActiveTab(tabFromUrl as any);
        }
    }, []); // Only on mount

    // ── Update URL when tab changes ──
    const handleTabChange = (tabId: string) => {
        admin.setActiveTab(tabId as any);
        setSearchParams({ tab: tabId }, { replace: true });
    };

    // ── Entities state ──
    const [entities, setEntities] = useState<Entity[]>([]);

    // ── Build approverEntityMap: userId → entity name ──
    const approverEntityMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const entity of entities) {
            if (entity.approverId && entity.isActive) {
                map[entity.approverId] = entity.name;
            }
        }
        return map;
    }, [entities]);

    const fetchEntities = useCallback(async () => {
        try {
            const data = await entityService.listEntities();
            setEntities(data);
        } catch {}
    }, []);

    useEffect(() => {
        fetchEntities();
    }, [fetchEntities]);

    const activeTabMeta = ADMIN_TABS.find(t => t.id === admin.activeTab);

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
            {/* Breadcrumbs */}
            <Breadcrumbs items={[
                { label: 'Home', to: '/' },
                { label: 'Admin Console' },
            ]} />
            {/* Page header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-[#101418] tracking-tight">Admin Console</h1>
                <p className="text-[#44546f] mt-1 text-sm">System configuration and management</p>
            </div>

            <div className="flex gap-6 items-start">
                {/* ── Sidebar nav ── */}
                <aside className="w-56 flex-shrink-0 sticky top-20">
                    <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {(['Configuration', 'Workflows', 'Appearance'] as const).map(group => {
                            const items = ADMIN_TABS.filter(t => t.group === group);
                            return (
                                <div key={group}>
                                    <div className="px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-[#8993a4]">{group}</div>
                                    {items.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabChange(tab.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-left transition-all rounded-lg mx-0 ${
                                                admin.activeTab === tab.id
                                                    ? 'bg-[#e8f0fe] text-[#0052cc]'
                                                    : 'text-[#44546f] hover:bg-gray-50 hover:text-[#101418]'
                                            }`}
                                        >
                                            <span className={`material-symbols-outlined text-lg flex-shrink-0 ${admin.activeTab === tab.id ? 'text-[#0052cc]' : 'text-[#8993a4]'}`}>{tab.icon}</span>
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                        <div className="h-3" />
                    </nav>
                </aside>

                {/* ── Content area ── */}
                <div className="flex-1 min-w-0">
                    {/* Section header */}
                    {activeTabMeta && (
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-[#e8f0fe] flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-[#0052cc] text-lg">{activeTabMeta.icon}</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-[#101418] leading-tight">{activeTabMeta.label}</h2>
                                <p className="text-xs text-[#44546f]">{activeTabMeta.group}</p>
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    {admin.activeTab === 'service-desks' && (
                        <ServiceDesksTab
                            serviceDesks={admin.serviceDesks}
                            selectedDesk={admin.selectedDesk}
                            categories={admin.categories}
                            categorySearch={admin.categorySearch}
                            onCategorySearchChange={admin.setCategorySearch}
                            filteredCategories={admin.filteredCategories}
                            selectedCategory={admin.selectedCategory}
                            requestTypes={admin.requestTypes}
                            availableRoles={admin.availableRoles}
                            formData={admin.formData}
                            modalOpen={admin.modalOpen}
                            serviceModalOpen={admin.serviceModalOpen}
                            desksLoading={admin.desksLoading}
                            categoriesLoading={admin.categoriesLoading}
                            requestTypesLoading={admin.requestTypesLoading}
                            onDeskChange={admin.handleDeskChange}
                            onAddCategory={admin.openAddModal}
                            onEditCategory={admin.openEditModal}
                            onDeleteCategory={admin.handleDelete}
                            onReactivateCategory={admin.handleReactivate}
                            onMoveCategory={admin.handleMoveCategory}
                            onManageTypes={admin.handleManageTypes}
                            onOpenServiceModal={() => { if (admin.availableRoles.length === 0) admin.fetchRoles(); admin.setServiceModalOpen(true); }}
                            onDeleteService={admin.handleDeleteService}
                            onReactivateService={admin.handleReactivateService}
                            onEditService={admin.openEditServiceModal}
                            onEditTypeName={admin.openEditTypeName}
                            onOpenFormBuilder={admin.openFormBuilder}
                            onAddDesk={admin.openAddDeskModal}
                            onEditDesk={admin.openEditDeskModal}
                            onDeleteDesk={admin.handleDeleteDesk}
                            onReactivateDesk={admin.handleReactivateDesk}
                        />
                    )}

                    {admin.activeTab === 'users' && (
                        <UserAccountsTab
                            users={admin.users}
                            usersLoading={admin.usersLoading}
                            userPagination={admin.userPagination}
                            userSearch={admin.userSearch}
                            userRoleFilter={admin.userRoleFilter}
                            userStatusFilter={admin.userStatusFilter}
                            userStats={admin.userStats}
                            availableRoles={admin.availableRoles}
                            entities={entities}
                            approverEntityMap={approverEntityMap}
                            onSearch={(value) => admin.fetchUsers(1, value, admin.userRoleFilter, admin.userStatusFilter)}
                            onRoleFilter={(value) => admin.fetchUsers(1, admin.userSearch, value, admin.userStatusFilter)}
                            onStatusFilter={(value) => admin.fetchUsers(1, admin.userSearch, admin.userRoleFilter, value)}
                            onFetchUsers={(page) => admin.fetchUsers(page, admin.userSearch, admin.userRoleFilter, admin.userStatusFilter)}
                            onCreateUser={() => admin.setShowCreateUserModal(true)}
                            onImportStaff={() => admin.setShowImportStaffModal(true)}
                            onEditUser={(user) => { admin.setEditingUser(user); admin.setShowEditUserModal(true); }}
                            onManageRoles={(user) => { admin.setRoleModalUser(user); admin.setRoleModalSelected(user.roles?.map((ur: any) => ur.role?.name || ur) || []); }}
                            onResetPassword={(user) => admin.setResetPasswordUser(user)}
                            onAssignAgentTeam={(user) => { admin.setRoleModalUser(user); admin.setShowAgentTeamModal(true); }}
                            onToggleUserStatus={(user) => {
                                if (user.isActive) {
                                    admin.setConfirmDisableUser(user);
                                } else {
                                    admin.handleToggleUserStatus(user);
                                }
                            }}
                        />
                    )}

                    {admin.activeTab === 'onboarding-tasks' && (
                        <OnboardingTasksTab
                            templates={admin.templates}
                            templatesLoading={admin.templatesLoading}
                            templateError={admin.templateError}
                            showTemplateForm={admin.showTemplateForm}
                            editingTemplate={admin.editingTemplate}
                            templateForm={admin.templateForm}
                            onSaveTemplate={admin.handleSaveTemplate}
                            onDeleteTemplate={admin.handleDeleteTemplate}
                            onEditTemplate={admin.handleEditTemplate}
                            onShowTemplateForm={admin.setShowTemplateForm}
                            onTemplateFormChange={admin.setTemplateForm}
                        />
                    )}

                    {admin.activeTab === 'offboarding-tasks' && (
                        <OffboardingTasksTab
                            templates={admin.offboardingTemplates}
                            templatesLoading={admin.offboardingTemplatesLoading}
                            templateError={admin.offboardingTemplateError}
                            showTemplateForm={admin.showOffboardingTemplateForm}
                            editingTemplate={admin.editingOffboardingTemplate}
                            templateForm={admin.offboardingTemplateForm as any}
                            onSaveTemplate={admin.handleSaveOffboardingTemplate}
                            onDeleteTemplate={admin.handleDeleteOffboardingTemplate}
                            onEditTemplate={admin.handleEditOffboardingTemplate}
                            onShowTemplateForm={admin.setShowOffboardingTemplateForm}
                            onTemplateFormChange={admin.setOffboardingTemplateForm}
                        />
                    )}

                    {/* Already extracted tabs */}
                    {admin.activeTab === 'workflow-config' && <WorkflowTransitionTab />}
                    {admin.activeTab === 'banner-config' && <BannerConfigTab />}
                    {admin.activeTab === 'status-definitions' && <StatusDefinitionsTab />}
                    {admin.activeTab === 'sla-escalation' && <SLAEscalationTab />}
                    {admin.activeTab === 'audit-logs' && <AuditLogTab />}
                    {admin.activeTab === 'scheduler' && <SchedulerSettings />}
                    {admin.activeTab === 'permissions' && <PermissionsTab />}
                    {admin.activeTab === 'email-notifications' && <EmailNotificationsTab />}

                    {admin.activeTab === 'entities' && (
                        <EntitiesTab
                            entities={entities}
                            users={admin.users.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }))}
                            onRefresh={fetchEntities}
                        />
                    )}

                </div>{/* end content area */}
            </div>{/* end flex row */}

            {/* Modals */}
            <CategoryModal
                isOpen={admin.modalOpen}
                editingCategory={admin.editingCategory}
                formData={admin.formData}
                onSave={admin.handleSave}
                onClose={() => admin.setModalOpen(false)}
                onFormDataChange={admin.setFormData}
            />

            <ServiceDeskModal
                isOpen={admin.deskModalOpen}
                editingDesk={admin.editingDesk}
                deskFormData={admin.deskFormData}
                onSave={admin.handleSaveDesk}
                onClose={() => admin.setDeskModalOpen(false)}
                onFormDataChange={admin.setDeskFormData}
            />

            <ServiceModal
                isOpen={admin.serviceModalOpen}
                selectedCategory={admin.selectedCategory}
                availableRoles={admin.availableRoles}
                serviceFormData={admin.serviceFormData}
                editingService={admin.editingService}
                onCreateService={admin.handleCreateService}
                onUpdateService={admin.handleUpdateService}
                onClose={() => { admin.setServiceModalOpen(false); admin.setEditingService(null); }}
                onFormDataChange={admin.setServiceFormData}
            />

            <RoleAssignmentModal
                isOpen={!!admin.roleModalUser}
                user={admin.roleModalUser}
                availableRoles={admin.availableRoles}
                selectedRoles={admin.roleModalSelected}
                onSave={admin.handleSaveRoles}
                onClose={() => admin.setRoleModalUser(null)}
                onRoleToggle={(roleName, checked) => {
                    if (checked) {
                        admin.setRoleModalSelected([...admin.roleModalSelected, roleName]);
                    } else {
                        admin.setRoleModalSelected(admin.roleModalSelected.filter(r => r !== roleName));
                    }
                }}
            />

            <AgentTeamModal
                isOpen={admin.showAgentTeamModal}
                user={admin.roleModalUser}
                selectedTeam={admin.selectedAgentTeam}
                onTeamChange={admin.setSelectedAgentTeam}
                onAssign={async () => {
                    try {
                        const apiClient = (await import('../src/services/api')).default;
                        await apiClient.put(`/users/${admin.roleModalUser.id}`, { agentTeam: admin.selectedAgentTeam || null });
                        admin.setShowAgentTeamModal(false);
                        await admin.fetchUsers(admin.userPagination.page);
                    } catch (err: any) {
                        alert(err.response?.data?.message || 'Failed to assign agent team');
                    }
                }}
                onClose={() => admin.setShowAgentTeamModal(false)}
            />

            {/* Create User Modal */}
            {admin.showCreateUserModal && (
                <CreateUserModal
                    onSuccess={() => admin.fetchUsers(1, admin.userSearch, admin.userRoleFilter)}
                    onClose={() => admin.setShowCreateUserModal(false)}
                    entities={entities}
                />
            )}

            {/* Import Staff Modal */}
            {admin.showImportStaffModal && (
                <ImportStaffModal
                    onSuccess={() => admin.fetchUsers(1, admin.userSearch, admin.userRoleFilter)}
                    onClose={() => admin.setShowImportStaffModal(false)}
                />
            )}

            {/* UserEditModal */}
            <UserEditModal
                user={admin.editingUser}
                isOpen={admin.showEditUserModal}
                onClose={() => { admin.setShowEditUserModal(false); admin.setEditingUser(null); }}
                onSave={admin.handleEditUser}
                entities={entities}
            />

            {/* Reset Password Modal */}
            {admin.resetPasswordUser && (
                <ResetPasswordModal
                    user={admin.resetPasswordUser}
                    onClose={() => admin.setResetPasswordUser(null)}
                    onSuccess={() => admin.fetchUsers(admin.userPagination.page)}
                />
            )}

            {/* Confirm Disable User Dialog */}
            {admin.confirmDisableUser && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-10 scale-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-500 text-2xl">block</span>
                            </div>
                            <h3 className="text-xl font-black text-[#101418]">Disable Account</h3>
                        </div>
                        <p className="text-[#44546f] font-medium mb-8">
                            Are you sure you want to disable <strong>{admin.confirmDisableUser.firstName} {admin.confirmDisableUser.lastName}</strong>? They will no longer be able to log in.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => admin.setConfirmDisableUser(null)}
                                className="flex-1 py-3 bg-gray-100 text-[#44546f] font-black rounded-2xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    admin.handleToggleUserStatus(admin.confirmDisableUser);
                                    admin.setConfirmDisableUser(null);
                                }}
                                className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all text-xs uppercase tracking-widest"
                            >
                                Disable
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            {admin.pendingAction && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-10 scale-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
                            </div>
                            <h3 className="text-xl font-black text-[#101418]">Confirm Action</h3>
                        </div>
                        <p className="text-[#44546f] font-medium mb-8">{admin.pendingAction.message}</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => admin.setPendingAction(null)}
                                className="flex-1 py-3 bg-gray-100 text-[#44546f] font-black rounded-2xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={admin.executePendingAction}
                                className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all text-xs uppercase tracking-widest"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {admin.toastMsg && (
                <div className={`fixed bottom-6 right-6 z-[90] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white font-bold text-sm transition-all ${admin.toastMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
                    <span className="material-symbols-outlined text-xl">{admin.toastMsg.type === 'error' ? 'error' : 'check_circle'}</span>
                    {admin.toastMsg.text}
                </div>
            )}

            {/* Edit Request Type Name Modal */}
            <RequestTypeEditModal
                isOpen={!!admin.editingTypeName}
                editingTypeName={admin.editingTypeName}
                editTypeForm={admin.editTypeForm}
                savingTypeName={admin.savingTypeName}
                workflowTypes={admin.workflowTypes}
                workflowTypesLoading={admin.workflowTypesLoading}
                onSave={admin.handleSaveTypeName}
                onClose={() => admin.setEditingTypeName(null)}
                onFormChange={admin.setEditTypeForm}
            />

            {/* Form Builder Modal */}
            <FormBuilderModal
                isOpen={admin.formBuilderOpen && !!admin.selectedType}
                selectedType={admin.selectedType}
                onSave={admin.handleSaveFormConfig}
                onClose={() => admin.setFormBuilderOpen(false)}
            />
        </div>
    );
};

export default AdminSettings;
