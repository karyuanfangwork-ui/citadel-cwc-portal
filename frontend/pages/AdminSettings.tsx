import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../src/context/AuthContext';
import FormBuilder from '../src/components/FormBuilder';
import CreateUserModal from '../src/components/admin/CreateUserModal';
import UserEditModal from '../src/components/admin/UserEditModal';
import { StatusDefinitionsTab } from '../src/components/admin/StatusDefinitionsTab';
import { WorkflowTransitionTab } from '../src/components/admin/WorkflowTransitionTab';
import { BannerConfigTab } from '../src/components/admin/BannerConfigTab';
import { EmailNotificationsTab } from '../src/components/admin/EmailNotificationsTab';
import { PermissionsTab } from '../src/components/admin/PermissionsTab';
import { EntitiesTab } from '../src/components/admin/EntitiesTab';
import { AuditLogTab } from '../src/components/admin/AuditLogTab';
import { SLAEscalationTab } from '../src/components/admin/SLAEscalationTab';
import { useAdminState } from '../src/components/admin/useAdminState';
import { ADMIN_TABS, CATEGORY_ICONS, COLOR_THEMES } from '../src/components/admin/adminConstants';
import { ServiceDesksTab } from '../src/components/admin/ServiceDesksTab';
import { UserAccountsTab } from '../src/components/admin/UserAccountsTab';
import { OnboardingTasksTab } from '../src/components/admin/OnboardingTasksTab';
import { OffboardingTasksTab } from '../src/components/admin/OffboardingTasksTab';
import { CategoryModal } from '../src/components/admin/CategoryModal';
import { ServiceModal } from '../src/components/admin/ServiceModal';
import { RoleAssignmentModal } from '../src/components/admin/RoleAssignmentModal';
import { AgentTeamModal } from '../src/components/admin/AgentTeamModal';
import { entityService, Entity } from '../src/services/entity.service';

const AdminSettings = () => {
    const { logout } = useAuth();
    const admin = useAdminState();

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
                                            onClick={() => admin.setActiveTab(tab.id)}
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
                            selectedCategory={admin.selectedCategory}
                            requestTypes={admin.requestTypes}
                            availableRoles={admin.availableRoles}
                            formData={admin.formData}
                            modalOpen={admin.modalOpen}
                            serviceModalOpen={admin.serviceModalOpen}
                            onDeskChange={admin.handleDeskChange}
                            onAddCategory={admin.openAddModal}
                            onEditCategory={admin.openEditModal}
                            onDeleteCategory={admin.handleDelete}
                            onReactivateCategory={admin.handleReactivate}
                            onMoveCategory={admin.handleMoveCategory}
                            onManageTypes={admin.handleManageTypes}
                            onOpenServiceModal={() => { if (admin.availableRoles.length === 0) admin.fetchRoles(); admin.setServiceModalOpen(true); }}
                            onDeleteService={admin.handleDeleteService}
                            onEditTypeName={admin.openEditTypeName}
                            onOpenFormBuilder={admin.openFormBuilder}
                        />
                    )}

                    {admin.activeTab === 'users' && (
                        <UserAccountsTab
                            users={admin.users}
                            usersLoading={admin.usersLoading}
                            userPagination={admin.userPagination}
                            userSearch={admin.userSearch}
                            userRoleFilter={admin.userRoleFilter}
                            availableRoles={admin.availableRoles}
                            entities={entities}
                            approverEntityMap={approverEntityMap}
                            onSearch={(value) => { admin.userSearch = value; admin.fetchUsers(1, value, admin.userRoleFilter); }}
                            onRoleFilter={(value) => { admin.userRoleFilter = value; admin.fetchUsers(1, admin.userSearch, value); }}
                            onFetchUsers={admin.fetchUsers}
                            onCreateUser={() => admin.setShowCreateUserModal(true)}
                            onEditUser={(user) => { admin.setEditingUser(user); admin.setShowEditUserModal(true); }}
                            onManageRoles={(user) => { admin.setRoleModalUser(user); admin.setRoleModalSelected(user.roles?.map((ur: any) => ur.role?.name || ur) || []); }}
                            onToggleUserStatus={admin.handleToggleUserStatus}
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

            <ServiceModal
                isOpen={admin.serviceModalOpen}
                selectedCategory={admin.selectedCategory}
                availableRoles={admin.availableRoles}
                serviceFormData={admin.serviceFormData}
                onCreateService={admin.handleCreateService}
                onClose={() => admin.setServiceModalOpen(false)}
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
            {admin.editingTypeName && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[#101418]">Edit Request Type</h2>
                                <button
                                    onClick={() => admin.setEditingTypeName(null)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    disabled={admin.savingTypeName}
                                >
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#101418] mb-2">Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                        value={admin.editTypeForm.name}
                                        onChange={e => admin.setEditTypeForm({ ...admin.editTypeForm, name: e.target.value })}
                                        disabled={admin.savingTypeName}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#101418] mb-2">Description</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none resize-none"
                                        value={admin.editTypeForm.description}
                                        onChange={e => admin.setEditTypeForm({ ...admin.editTypeForm, description: e.target.value })}
                                        disabled={admin.savingTypeName}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#101418] mb-2">Workflow Type</label>
                                    <select
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none bg-white"
                                        value={admin.editTypeForm.workflowTypeId}
                                        onChange={e => admin.setEditTypeForm({ ...admin.editTypeForm, workflowTypeId: e.target.value })}
                                        disabled={admin.savingTypeName || admin.workflowTypesLoading}
                                    >
                                        <option value="">Default (by Service Desk)</option>
                                        {admin.workflowTypes.map(wt => (
                                            <option key={wt.id} value={wt.id}>{wt.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-[#8993a4] mt-1">Determines the status stepper displayed for this request type.</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="block text-sm font-bold text-[#101418] mb-2">SLA Hours</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        placeholder="e.g. 24"
                                        value={admin.editTypeForm.slaHours}
                                        onChange={e => admin.setEditTypeForm({ ...admin.editTypeForm, slaHours: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                        disabled={admin.savingTypeName}
                                    />
                                    <p className="text-xs text-[#8993a4] mt-1">Leave blank to disable SLA tracking for this request type.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    type="button"
                                    className="px-6 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
                                    onClick={() => admin.setEditingTypeName(null)}
                                    disabled={admin.savingTypeName}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="px-6 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#0043a8] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    onClick={admin.handleSaveTypeName}
                                    disabled={admin.savingTypeName || !admin.editTypeForm.name.trim()}
                                >
                                    {admin.savingTypeName ? (
                                        <><span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>Saving...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-lg">save</span>Save Changes</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Builder Modal */}
            {admin.formBuilderOpen && admin.selectedType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <FormBuilder
                            initialFields={admin.selectedType.formConfig || []}
                            onSave={admin.handleSaveFormConfig}
                            onCancel={() => admin.setFormBuilderOpen(false)}
                            title={`Configure Form: ${admin.selectedType.name}`}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
