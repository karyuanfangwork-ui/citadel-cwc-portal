import React, { useState, useEffect } from 'react';
import { serviceDeskService } from '../src/services/serviceDesk.service';
import { adminService, CategoryData } from '../src/services/admin.service';
import FormBuilder from '../src/components/FormBuilder';
import { OnboardingTaskTemplate } from '../types';
import apiClient from '../src/services/api';

const CATEGORY_ICONS = [
    { name: 'laptop', label: 'Laptop/Hardware' },
    { name: 'apps', label: 'Applications' },
    { name: 'key', label: 'Access/Security' },
    { name: 'mail', label: 'Email' },
    { name: 'wifi', label: 'Network' },
    { name: 'dns', label: 'Servers' },
    { name: 'terminal', label: 'Development' },
    { name: 'groups', label: 'People/HR' },
    { name: 'payments', label: 'Finance' },
    { name: 'event_available', label: 'Calendar/Leave' },
    { name: 'health_and_safety', label: 'Benefits/Health' },
    { name: 'school', label: 'Training' },
    { name: 'receipt_long', label: 'Expenses' },
    { name: 'shopping_cart', label: 'Procurement' },
    { name: 'business', label: 'Vendors' },
    { name: 'help', label: 'General Help' },
];

const COLOR_THEMES = [
    { name: 'Blue', class: 'bg-blue-50 text-blue-600' },
    { name: 'Indigo', class: 'bg-indigo-50 text-indigo-600' },
    { name: 'Purple', class: 'bg-purple-50 text-purple-600' },
    { name: 'Emerald', class: 'bg-emerald-50 text-emerald-600' },
    { name: 'Amber', class: 'bg-amber-50 text-amber-600' },
    { name: 'Red', class: 'bg-red-50 text-red-600' },
    { name: 'Cyan', class: 'bg-cyan-50 text-cyan-600' },
    { name: 'Pink', class: 'bg-pink-50 text-pink-600' },
];

const AdminSettings = () => {
    const [serviceDesks, setServiceDesks] = useState<any[]>([]);
    const [selectedDesk, setSelectedDesk] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [requestTypes, setRequestTypes] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [formBuilderOpen, setFormBuilderOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<any>(null);
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [serviceFormData, setServiceFormData] = useState({ name: '', description: '', icon: 'bolt', requiresApproval: false, slaHours: '', requiredRole: '' });

    const [pendingAction, setPendingAction] = useState<{ message: string; onConfirm: () => Promise<void> } | null>(null);
    const [toastMsg, setToastMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    const [activeTab, setActiveTab] = useState<'service-desks' | 'users' | 'onboarding-tasks' | 'workflow-config'>('service-desks');
    const [users, setUsers] = useState<any[]>([]);
    const [userPagination, setUserPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('');
    const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; description: string }[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [roleModalUser, setRoleModalUser] = useState<any | null>(null);
    const [roleModalSelected, setRoleModalSelected] = useState<string[]>([]);
    const [showAgentTeamModal, setShowAgentTeamModal] = useState(false);
    const [selectedAgentTeam, setSelectedAgentTeam] = useState<string>('');

    // Onboarding Task Templates state
    const [templates, setTemplates] = useState<OnboardingTaskTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<OnboardingTaskTemplate | null>(null);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [templateForm, setTemplateForm] = useState({
        taskName: '',
        taskDescription: '',
        taskCategory: 'IT' as 'IT' | 'HR' | 'TRAINING' | 'ADMIN',
        priority: 'MEDIUM' as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        dueDayOffset: 0,
        displayOrder: 0,
    });

    const [formData, setFormData] = useState<CategoryData>({
        name: '',
        description: '',
        icon: 'laptop',
        colorClass: 'bg-blue-50 text-blue-600',
        displayOrder: 0,
        isActive: true,
    });

    // Workflow Configuration state
    const [workflowServiceDesks, setWorkflowServiceDesks] = useState<any[]>([]);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [workflowSaving, setWorkflowSaving] = useState<string | null>(null);

    const showToast = (type: 'error' | 'success', text: string) => {
        setToastMsg({ type, text });
        setTimeout(() => setToastMsg(null), 4000);
    };

    const executePendingAction = async () => {
        if (!pendingAction) return;
        try {
            await pendingAction.onConfirm();
        } catch (err) {
            console.error('Action failed:', err);
            showToast('error', 'Action failed. Please try again.');
        } finally {
            setPendingAction(null);
        }
    };

    useEffect(() => {
        fetchServiceDesks();
    }, []);

    useEffect(() => {
        if (activeTab === 'onboarding-tasks') {
            fetchTemplates();
        } else if (activeTab === 'users') {
            fetchUsers(1, '', '');
            fetchRoles();
        } else if (activeTab === 'workflow-config') {
            fetchWorkflowConfig();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const fetchServiceDesks = async () => {
        try {
            setLoading(true);
            const desks = await serviceDeskService.getAllServiceDesks();
            setServiceDesks(desks);
            if (desks.length > 0) {
                setSelectedDesk(desks[0]);
                fetchCategories(desks[0].id);
            }
        } catch (err) {
            console.error('Error fetching service desks:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async (deskId: string) => {
        try {
            const cats = await adminService.getAllCategoriesAdmin(deskId);
            setCategories(cats);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchUsers = async (page = 1, search = userSearch, roleFilter = userRoleFilter) => {
        setUsersLoading(true);
        try {
            const result = await adminService.listUsers({ page, limit: 15, search: search || undefined, role: roleFilter || undefined });
            setUsers(result.users);
            setUserPagination(result.pagination);
        } catch (err) {
            console.error('Error fetching users:', err);
            showToast('error', 'Failed to load users.');
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const roles = await adminService.listRoles();
            setAvailableRoles(roles);
        } catch (err) {
            console.error('Error fetching roles:', err);
        }
    };

    const fetchTemplates = async () => {
        setTemplatesLoading(true);
        setTemplateError(null);
        try {
            const res = await apiClient.get('/admin/onboarding-templates');
            setTemplates(res.data.data);
        } catch (err: any) {
            setTemplateError(err.message || 'Failed to load templates');
        } finally {
            setTemplatesLoading(false);
        }
    };

    const fetchWorkflowConfig = async () => {
        setWorkflowLoading(true);
        try {
            const desks = await serviceDeskService.getAllServiceDesks();
            const desksWithTypes = await Promise.all(
                desks.map(async (desk: any) => {
                    const types = await serviceDeskService.getRequestTypes(desk.id);
                    return { ...desk, categories: types };
                })
            );
            setWorkflowServiceDesks(desksWithTypes);
        } catch (err: any) {
            showToast('error', 'Failed to load workflow config');
        } finally {
            setWorkflowLoading(false);
        }
    };

    const handleWorkflowToggle = async (typeId: string, currentValue: boolean) => {
        setWorkflowSaving(typeId);
        try {
            await serviceDeskService.updateRequestType(typeId, { requiresApproval: !currentValue });
            setWorkflowServiceDesks(prev =>
                prev.map(desk => ({
                    ...desk,
                    categories: desk.categories.map((cat: any) => ({
                        ...cat,
                        requestTypes: cat.requestTypes?.map((type: any) =>
                            type.id === typeId ? { ...type, requiresApproval: !currentValue } : type
                        ) || []
                    }))
                }))
            );
            showToast('success', 'Workflow configuration updated');
        } catch (err: any) {
            showToast('error', 'Failed to update workflow');
        } finally {
            setWorkflowSaving(null);
        }
    };

    const handleSaveTemplate = async () => {
        try {
            if (editingTemplate) {
                const res = await apiClient.put(`/admin/onboarding-templates/${editingTemplate.id}`, templateForm);
                setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? res.data : t));
            } else {
                const res = await apiClient.post('/admin/onboarding-templates', templateForm);
                setTemplates(prev => [...prev, res.data]);
            }
            setShowTemplateForm(false);
            setEditingTemplate(null);
            setTemplateForm({ taskName: '', taskDescription: '', taskCategory: 'IT', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 0 });
        } catch (err: any) {
            setTemplateError(err.message || 'Failed to save template');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Delete this template? This will not affect existing onboarding checklists.')) return;
        try {
            await apiClient.delete(`/admin/onboarding-templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            setTemplateError(err.message || 'Failed to delete template');
        }
    };

    const handleEditTemplate = (template: OnboardingTaskTemplate) => {
        setEditingTemplate(template);
        setTemplateForm({
            taskName: template.taskName,
            taskDescription: template.taskDescription || '',
            taskCategory: template.taskCategory,
            priority: template.priority,
            dueDayOffset: template.dueDayOffset,
            displayOrder: template.displayOrder,
        });
        setShowTemplateForm(true);
    };

    const handleDeskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const desk = serviceDesks.find(d => d.id === e.target.value);
        setSelectedDesk(desk);
        fetchCategories(desk.id);
        setSelectedCategory(null);
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormData({
            name: '',
            description: '',
            icon: 'laptop',
            colorClass: 'bg-blue-50 text-blue-600',
            displayOrder: categories.length + 1,
            isActive: true,
        });
        setModalOpen(true);
    };

    const openEditModal = (cat: any) => {
        setEditingCategory(cat);
        setFormData({
            name: cat.name,
            description: cat.description || '',
            icon: cat.icon || 'laptop',
            colorClass: cat.colorClass || 'bg-blue-50 text-blue-600',
            displayOrder: cat.displayOrder || 0,
            isActive: cat.isActive !== false,
        });
        setModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDesk) return;

        try {
            if (editingCategory) {
                await adminService.updateCategory(selectedDesk.id, editingCategory.id, formData);
            } else {
                await adminService.createCategory(selectedDesk.id, formData);
            }
            setModalOpen(false);
            fetchCategories(selectedDesk.id);
            showToast('success', editingCategory ? 'Category updated.' : 'Category created.');
        } catch (err) {
            console.error('Error saving category:', err);
            showToast('error', 'Failed to save. Ensure the category name is unique for this service desk.');
        }
    };

    const handleDelete = (catId: string) => {
        setPendingAction({
            message: 'Deactivate this category? It will be hidden from users but can be restored.',
            onConfirm: async () => {
                if (!selectedDesk) return;
                await adminService.deleteCategory(selectedDesk.id, catId);
                fetchCategories(selectedDesk.id);
                showToast('success', 'Category deactivated.');
            },
        });
    };

    const handleReactivate = (catId: string) => {
        setPendingAction({
            message: 'Reactivate this category? It will become visible to users again.',
            onConfirm: async () => {
                if (!selectedDesk) return;
                await adminService.updateCategory(selectedDesk.id, catId, { isActive: true });
                fetchCategories(selectedDesk.id);
                showToast('success', 'Category reactivated.');
            },
        });
    };

    const handleDeleteService = (typeId: string) => {
        setPendingAction({
            message: 'Deactivate this service? It will be hidden from users but can be restored.',
            onConfirm: async () => {
                await serviceDeskService.deleteRequestType(typeId);
                if (selectedCategory) {
                    const types = await serviceDeskService.getRequestTypes(selectedDesk.id, selectedCategory.id);
                    setRequestTypes(types);
                }
                showToast('success', 'Service deactivated.');
            },
        });
    };

    const handleCreateService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDesk || !selectedCategory) return;
        try {
            await adminService.createService({
                categoryId: selectedCategory.id,
                name: serviceFormData.name,
                description: serviceFormData.description,
                icon: serviceFormData.icon,
                requiresApproval: serviceFormData.requiresApproval,
                slaHours: serviceFormData.slaHours ? parseInt(serviceFormData.slaHours) : null,
                requiredRole: serviceFormData.requiredRole || null,
            });
            setServiceModalOpen(false);
            setServiceFormData({ name: '', description: '', icon: 'bolt', requiresApproval: false, slaHours: '', requiredRole: '' });
            const types = await serviceDeskService.getRequestTypes(selectedDesk.id, selectedCategory.id);
            setRequestTypes(types);
            showToast('success', 'Service created.');
        } catch (err) {
            console.error('Error creating service:', err);
            showToast('error', 'Failed to create service.');
        }
    };

    const handleToggleUserStatus = async (user: any) => {
        try {
            await adminService.updateUserStatus(user.id, !user.isActive);
            fetchUsers(userPagination.page);
            showToast('success', `Account ${!user.isActive ? 'enabled' : 'disabled'}.`);
        } catch (err) {
            console.error('Error toggling user status:', err);
            showToast('error', 'Failed to update account status.');
        }
    };

    const handleSaveRoles = async () => {
        if (!roleModalUser || roleModalSelected.length === 0) return;
        try {
            await adminService.assignUserRoles(roleModalUser.id, roleModalSelected);
            setRoleModalUser(null);
            fetchUsers(userPagination.page);
            showToast('success', 'Roles updated. User session revoked — they must log in again.');
        } catch (err) {
            console.error('Error saving roles:', err);
            showToast('error', 'Failed to update roles.');
        }
    };

    const handleMoveCategory = async (cat: any, direction: 'up' | 'down') => {
        if (!selectedDesk) return;
        const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
        const idx = sorted.findIndex(c => c.id === cat.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const swapTarget = sorted[swapIdx];
        try {
            await adminService.updateCategory(selectedDesk.id, cat.id, { displayOrder: swapTarget.displayOrder });
            await adminService.updateCategory(selectedDesk.id, swapTarget.id, { displayOrder: cat.displayOrder });
            fetchCategories(selectedDesk.id);
        } catch (err) {
            console.error('Error reordering category:', err);
            showToast('error', 'Failed to reorder categories.');
        }
    };

    const handleManageTypes = async (cat: any) => {
        if (selectedCategory?.id === cat.id) {
            setSelectedCategory(null);
            return;
        }
        setSelectedCategory(cat);
        try {
            const types = await serviceDeskService.getRequestTypes(selectedDesk.id, cat.id);
            setRequestTypes(types);
        } catch (err) {
            console.error('Error fetching request types:', err);
        }
    };

    const openFormBuilder = (type: any) => {
        setSelectedType(type);
        setFormBuilderOpen(true);
    };

    const handleSaveFormConfig = async (fields: any[]) => {
        if (!selectedType) return;
        try {
            await serviceDeskService.updateRequestType(selectedType.id, {
                formConfig: fields
            });
            showToast('success', 'Form configuration saved successfully.');
            setFormBuilderOpen(false);
            if (selectedCategory) {
                // Refresh request types
                const types = await serviceDeskService.getRequestTypes(selectedDesk.id, selectedCategory.id);
                setRequestTypes(types);
            }
        } catch (err) {
            console.error('Error saving form config:', err);
            showToast('error', 'Failed to save form configuration.');
        }
    };

    if (loading) return <div className="p-8 text-center text-[#44546f] font-bold">Loading system settings...</div>;

    return (
        <div className="max-w-[1240px] mx-auto px-6 py-12">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-[#101418] tracking-tight">Admin Console</h1>
                    <p className="text-[#44546f] mt-2 font-medium">Configure service desks, categories, and dynamic forms.</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 mb-8 border-b border-gray-200">
                {([
                    { id: 'service-desks', label: 'Service Desks', icon: 'support_agent' },
                    { id: 'users', label: 'User Accounts', icon: 'manage_accounts' },
                    { id: 'onboarding-tasks', label: 'Onboarding Tasks', icon: 'checklist' },
                    { id: 'workflow-config', label: 'Workflow Config', icon: 'account_tree' },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-black uppercase tracking-widest border-b-2 transition-all -mb-[2px] ${activeTab === tab.id ? 'border-[#0052cc] text-[#0052cc]' : 'border-transparent text-[#44546f] hover:text-[#101418]'}`}
                    >
                        <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'service-desks' && (
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50/20">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-[#44546f] uppercase tracking-wider">Service Desk</label>
                        <div className="relative">
                            <select
                                className="pl-6 pr-12 py-3 bg-white border border-gray-200 rounded-2xl text-base font-bold text-[#101418] focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none cursor-pointer appearance-none transition-all"
                                value={selectedDesk?.id || ''}
                                onChange={handleDeskChange}
                            >
                                {serviceDesks.map(desk => (
                                    <option key={desk.id} value={desk.id}>{desk.name}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                        </div>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-8 py-3.5 bg-[#0052cc] text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-sm uppercase tracking-widest text-xs"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        Add Category
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-[11px] font-black text-[#44546f] uppercase tracking-[0.2em]">
                                <th className="px-8 py-5 w-20">Order</th>
                                <th className="px-8 py-5 w-16">Icon</th>
                                <th className="px-8 py-5">Category Name</th>
                                <th className="px-8 py-5">Status</th>
                                <th className="px-8 py-5">Services</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {categories.map(cat => (
                                <tr key={cat.id} className={`hover:bg-gray-50/50 transition-colors ${selectedCategory?.id === cat.id ? 'bg-blue-50/30' : ''} ${!cat.isActive ? 'opacity-50' : ''}`}>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-center gap-1">
                                            <button
                                                onClick={() => handleMoveCategory(cat, 'up')}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-300 hover:text-[#0052cc] transition-all"
                                                title="Move up"
                                            >
                                                <span className="material-symbols-outlined text-base">arrow_upward</span>
                                            </button>
                                            <span className="font-bold text-gray-400 text-sm">{cat.displayOrder}</span>
                                            <button
                                                onClick={() => handleMoveCategory(cat, 'down')}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-300 hover:text-[#0052cc] transition-all"
                                                title="Move down"
                                            >
                                                <span className="material-symbols-outlined text-base">arrow_downward</span>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className={`w-12 h-12 ${cat.colorClass} rounded-xl flex items-center justify-center shadow-sm`}>
                                            <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-[#101418] text-lg">{cat.name}</div>
                                        <div className="text-sm text-[#44546f] max-w-xs truncate mt-1">{cat.description || 'No description'}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cat.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                            {cat.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <button
                                            onClick={() => handleManageTypes(cat)}
                                            className={`group flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${selectedCategory?.id === cat.id ? 'bg-[#0052cc] text-white border-[#0052cc] shadow-lg shadow-blue-100' : 'bg-white text-[#44546f] border-gray-200 hover:border-[#0052cc] hover:text-[#0052cc]'}`}
                                        >
                                            <span className="material-symbols-outlined text-xl">settings_input_component</span>
                                            <span className="text-xs font-black uppercase tracking-widest">Manage</span>
                                        </button>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={() => openEditModal(cat)}
                                                className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Edit category"
                                            >
                                                <span className="material-symbols-outlined text-xl">edit</span>
                                            </button>
                                            {cat.isActive ? (
                                                <button
                                                    onClick={() => handleDelete(cat.id)}
                                                    className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-red-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                    title="Deactivate category"
                                                >
                                                    <span className="material-symbols-outlined text-xl">delete</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleReactivate(cat.id)}
                                                    className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-emerald-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                    title="Reactivate category"
                                                >
                                                    <span className="material-symbols-outlined text-xl">restore</span>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Services/Request Types Management Panel */}
                {selectedCategory && (
                    <div className="border-t-4 border-[#0052cc] bg-gray-50/50 p-10 scale-in shadow-inner">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="material-symbols-outlined text-[#0052cc]">settings_input_component</span>
                                    <h3 className="text-2xl font-black text-[#101418]">Services for {selectedCategory.name}</h3>
                                </div>
                                <p className="text-[#44546f] font-medium">Configure individual request forms and their custom fields.</p>
                            </div>
                            <button
                                onClick={() => { if (availableRoles.length === 0) fetchRoles(); setServiceModalOpen(true); }}
                                className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-[#101418] font-bold rounded-2xl hover:bg-gray-100 transition-all text-xs uppercase tracking-widest shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">add</span> New Service
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {requestTypes.map(type => (
                                <div key={type.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/30 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>

                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className={`w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-[#0052cc] group-hover:text-white transition-all duration-300 shadow-sm`}>
                                                <span className="material-symbols-outlined text-2xl">{type.icon || 'bolt'}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openFormBuilder(type)}
                                                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#0052cc] hover:bg-blue-50 rounded-xl transition-all"
                                                    title="Configure Form Fields"
                                                >
                                                    <span className="material-symbols-outlined text-[22px]">dynamic_form</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteService(type.id)}
                                                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Deactivate service"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <h4 className="font-black text-[#101418] text-lg mb-2">{type.name}</h4>
                                        <p className="text-sm text-[#44546f] mb-6 line-clamp-2 min-h-[40px] leading-relaxed">{type.description || 'No description provided for this service.'}</p>

                                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#0052cc] bg-blue-50 px-3 py-1 rounded-full">
                                                {type.formConfig?.length || 0} Custom Fields
                                            </span>
                                            <span className="material-symbols-outlined text-gray-300 group-hover:text-[#0052cc] transition-colors">arrow_forward</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {requestTypes.length === 0 && (
                                <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                                    <span className="material-symbols-outlined text-4xl text-gray-200 mb-4">inventory_2</span>
                                    <p className="text-[#44546f] font-bold">No services found for this category.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            )}

            {activeTab === 'users' && (
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
                                onChange={e => { setUserSearch(e.target.value); fetchUsers(1, e.target.value, userRoleFilter); }}
                            />
                        </div>
                        <select
                            className="pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none appearance-none"
                            value={userRoleFilter}
                            onChange={e => { setUserRoleFilter(e.target.value); fetchUsers(1, userSearch, e.target.value); }}
                        >
                            <option value="">All Roles</option>
                            {availableRoles.map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
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
                                                        onClick={() => { setRoleModalUser(user); setRoleModalSelected(user.roles?.map((ur: any) => ur.role?.name || ur) || []); }}
                                                        className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                        title="Manage roles"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                                                    </button>
                                                    {user.roles?.some((ur: any) => ur.role?.name === 'AGENT') && (
                                                        <button
                                                            onClick={() => { setRoleModalUser(user); setSelectedAgentTeam(user.agentTeam || ''); setShowAgentTeamModal(true); }}
                                                            className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-amber-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                            title="Assign agent team (IT/HR)"
                                                        >
                                                            <span className="material-symbols-outlined text-xl">groups</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleToggleUserStatus(user)}
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
                                            <td colSpan={5} className="px-8 py-16 text-center text-[#44546f] font-bold">No users found.</td>
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
                                    onClick={() => fetchUsers(userPagination.page - 1)}
                                    disabled={userPagination.page <= 1}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-[#44546f] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >Previous</button>
                                <button
                                    onClick={() => fetchUsers(userPagination.page + 1)}
                                    disabled={userPagination.page >= userPagination.totalPages}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-[#44546f] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'onboarding-tasks' && (
                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-[#101418]">Onboarding Task Templates</h2>
                            <p className="text-sm text-[#44546f] mt-1">These tasks are automatically added to every new hire's onboarding checklist.</p>
                        </div>
                        <button
                            onClick={() => { setEditingTemplate(null); setTemplateForm({ taskName: '', taskDescription: '', taskCategory: 'IT', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 0 }); setShowTemplateForm(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0052cc] text-white rounded-lg text-sm font-semibold hover:bg-[#0747a6] transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            Add Task
                        </button>
                    </div>

                    {templateError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{templateError}</div>}

                    {showTemplateForm && (
                        <div className="mb-6 p-5 border border-[#0052cc] rounded-lg bg-blue-50">
                            <h3 className="font-semibold text-[#101418] mb-4">{editingTemplate ? 'Edit Task Template' : 'New Task Template'}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Task Name *</label>
                                    <input
                                        type="text"
                                        value={templateForm.taskName}
                                        onChange={e => setTemplateForm(p => ({ ...p, taskName: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                        placeholder="e.g. Create Active Directory Account"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={templateForm.taskDescription}
                                        onChange={e => setTemplateForm(p => ({ ...p, taskDescription: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                        placeholder="Brief description of what needs to be done"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Category *</label>
                                    <select
                                        value={templateForm.taskCategory}
                                        onChange={e => setTemplateForm(p => ({ ...p, taskCategory: e.target.value as any }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                    >
                                        <option value="IT">IT</option>
                                        <option value="HR">HR</option>
                                        <option value="TRAINING">Training</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Priority *</label>
                                    <select
                                        value={templateForm.priority}
                                        onChange={e => setTemplateForm(p => ({ ...p, priority: e.target.value as any }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                    >
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Due Date Offset (days)</label>
                                    <input
                                        type="number"
                                        value={templateForm.dueDayOffset}
                                        onChange={e => setTemplateForm(p => ({ ...p, dueDayOffset: parseInt(e.target.value) || 0 }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                    />
                                    <p className="text-xs text-[#44546f] mt-1">Negative = before start date, 0 = on start date, positive = after</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Display Order</label>
                                    <input
                                        type="number"
                                        value={templateForm.displayOrder}
                                        onChange={e => setTemplateForm(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleSaveTemplate}
                                    disabled={!templateForm.taskName}
                                    className="px-4 py-2 bg-[#0052cc] text-white rounded-lg text-sm font-semibold hover:bg-[#0747a6] disabled:opacity-50 transition-colors"
                                >
                                    {editingTemplate ? 'Save Changes' : 'Add Template'}
                                </button>
                                <button
                                    onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}
                                    className="px-4 py-2 border border-gray-300 text-[#44546f] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {templatesLoading ? (
                        <div className="text-center py-8 text-[#44546f]">Loading templates...</div>
                    ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">#</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Task Name</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Category</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Priority</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Due Offset</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Status</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {templates.length === 0 ? (
                                        <tr><td colSpan={7} className="px-4 py-8 text-center text-[#44546f]">No templates yet. Add one above.</td></tr>
                                    ) : templates.map((template, index) => (
                                        <tr key={template.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-[#44546f]">{index + 1}</td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-[#101418]">{template.taskName}</p>
                                                {template.taskDescription && <p className="text-xs text-[#44546f] mt-0.5">{template.taskDescription}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    template.taskCategory === 'IT' ? 'bg-blue-100 text-blue-700' :
                                                    template.taskCategory === 'HR' ? 'bg-emerald-100 text-emerald-700' :
                                                    template.taskCategory === 'TRAINING' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>{template.taskCategory}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold ${
                                                    template.priority === 'CRITICAL' ? 'text-red-600' :
                                                    template.priority === 'HIGH' ? 'text-orange-600' :
                                                    template.priority === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-500'
                                                }`}>{template.priority}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[#44546f]">
                                                {template.dueDayOffset === 0 ? 'Start date' :
                                                 template.dueDayOffset < 0 ? `${Math.abs(template.dueDayOffset)}d before` :
                                                 `${template.dueDayOffset}d after`}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {template.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEditTemplate(template)} className="text-[#0052cc] hover:text-[#0747a6] text-xs font-semibold">Edit</button>
                                                    <button onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Category Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden scale-in">
                        <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-3xl font-black text-[#101418]">
                                {editingCategory ? 'Edit Category' : 'New Category'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                                <span className="material-symbols-outlined text-3xl">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Category Display Name *</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                        placeholder="e.g. Hardware Support"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Description</label>
                                    <textarea
                                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all resize-none leading-relaxed"
                                        placeholder="Explain what kind of requests fall under this category..."
                                        rows={4}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest">Visual Icon *</label>
                                    <div className="relative">
                                        <select
                                            className="w-full pl-6 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none cursor-pointer appearance-none transition-all"
                                            value={formData.icon}
                                            onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                        >
                                            {CATEGORY_ICONS.map(icon => (
                                                <option key={icon.name} value={icon.name}>{icon.label}</option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest">Position Order</label>
                                    <input
                                        type="number"
                                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                        value={formData.displayOrder}
                                        onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-4">Brand Accent Color *</label>
                                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                                        {COLOR_THEMES.map(theme => (
                                            <button
                                                key={theme.name}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, colorClass: theme.class })}
                                                className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${theme.class} ${formData.colorClass === theme.class ? 'ring-4 ring-[#0052cc]/30 border-2 border-white scale-110 z-10' : 'opacity-40 hover:opacity-100 hover:scale-105'}`}
                                            >
                                                {formData.colorClass === theme.class && <span className="material-symbols-outlined text-lg font-black">check</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="md:col-span-2 pt-4">
                                    <label className="flex items-center gap-4 cursor-pointer group">
                                        <div className="relative inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.isActive}
                                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                            />
                                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                        </div>
                                        <span className="text-sm font-black text-[#44546f] uppercase tracking-widest group-hover:text-[#101418] transition-colors">Category Visible to Users</span>
                                    </label>
                                </div>
                            </div>

                            <div className="mt-12 flex gap-6">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 px-8 py-5 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                                >
                                    Discard
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-8 py-5 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all shadow-sm uppercase tracking-widest text-xs"
                                >
                                    {editingCategory ? 'Commit Changes' : 'Confirm & Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* No-Code Form Builder Modal */}
            {formBuilderOpen && selectedType && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#091e42]/80 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden scale-in p-10">
                        <FormBuilder
                            title={`Configure Form: ${selectedType.name}`}
                            initialFields={selectedType.formConfig || []}
                            onSave={handleSaveFormConfig}
                            onCancel={() => setFormBuilderOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* New Service Modal */}
            {serviceModalOpen && selectedCategory && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#091e42]/70 backdrop-blur-sm">
                    <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden scale-in">
                        <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-[#101418]">New Service</h2>
                            <button onClick={() => setServiceModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                                <span className="material-symbols-outlined text-3xl">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleCreateService} className="p-10 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Service Name *</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                    placeholder="e.g. Laptop Replacement"
                                    value={serviceFormData.name}
                                    onChange={e => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Description</label>
                                <textarea
                                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all resize-none"
                                    placeholder="What does this service cover?"
                                    rows={3}
                                    value={serviceFormData.description}
                                    onChange={e => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">SLA (hours)</label>
                                    <input
                                        type="number"
                                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                        placeholder="e.g. 24"
                                        value={serviceFormData.slaHours}
                                        onChange={e => setServiceFormData({ ...serviceFormData, slaHours: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center pt-8">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded accent-[#0052cc]"
                                            checked={serviceFormData.requiresApproval}
                                            onChange={e => setServiceFormData({ ...serviceFormData, requiresApproval: e.target.checked })}
                                        />
                                        <span className="text-sm font-bold text-[#44546f]">Requires Approval</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#101418] mb-2">Required Role (optional)</label>
                                <select
                                    value={serviceFormData.requiredRole}
                                    onChange={e => setServiceFormData({ ...serviceFormData, requiredRole: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                                >
                                    <option value="">No restriction</option>
                                    {availableRoles.map(role => (
                                        <option key={role.name} value={role.name}>{role.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-[#44546f] mt-1">Only users with this role can submit this request type.</p>
                            </div>
                            <div className="flex gap-6 pt-4">
                                <button type="button" onClick={() => setServiceModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all text-xs uppercase tracking-widest">Create Service</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Role Assignment Modal */}
            {roleModalUser && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden scale-in">
                        <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-[#101418]">Assign Roles</h2>
                                <p className="text-sm text-[#44546f] mt-1">{roleModalUser.firstName} {roleModalUser.lastName}</p>
                            </div>
                            <button onClick={() => setRoleModalUser(null)} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                                <span className="material-symbols-outlined text-3xl">close</span>
                            </button>
                        </div>
                        <div className="p-10">
                            <p className="text-xs font-black text-[#44546f] uppercase tracking-widest mb-6">Select one or more roles</p>
                            <div className="space-y-3">
                                {availableRoles.map(role => (
                                    <label key={role.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-[#0052cc]/30 hover:bg-blue-50/20 cursor-pointer transition-all">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded accent-[#0052cc]"
                                            checked={roleModalSelected.includes(role.name)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setRoleModalSelected([...roleModalSelected, role.name]);
                                                } else {
                                                    setRoleModalSelected(roleModalSelected.filter(r => r !== role.name));
                                                }
                                            }}
                                        />
                                        <div>
                                            <div className="font-bold text-[#101418] text-sm">{role.name}</div>
                                            <div className="text-xs text-[#44546f]">{role.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button onClick={() => setRoleModalUser(null)} className="flex-1 py-4 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">Cancel</button>
                                <button
                                    onClick={handleSaveRoles}
                                    disabled={roleModalSelected.length === 0}
                                    className="flex-1 py-4 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                >Save Roles</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            {pendingAction && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-10 scale-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
                            </div>
                            <h3 className="text-xl font-black text-[#101418]">Confirm Action</h3>
                        </div>
                        <p className="text-[#44546f] font-medium mb-8">{pendingAction.message}</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setPendingAction(null)}
                                className="flex-1 py-3 bg-gray-100 text-[#44546f] font-black rounded-2xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executePendingAction}
                                className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all text-xs uppercase tracking-widest"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Agent Team Assignment Modal */}
            {roleModalUser && showAgentTeamModal && (
                <div className="fixed inset-0 z-[81] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden scale-in">
                        <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-[#101418]">Assign Agent Team</h2>
                                <p className="text-sm text-[#44546f] mt-1">{roleModalUser.firstName} {roleModalUser.lastName}</p>
                            </div>
                            <button onClick={() => setShowAgentTeamModal(false)} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                                <span className="material-symbols-outlined text-3xl">close</span>
                            </button>
                        </div>
                        <div className="p-10">
                            <p className="text-xs font-black text-[#44546f] uppercase tracking-widest mb-6">Select the team this agent manages</p>
                            <div className="space-y-3">
                                {['IT', 'HR'].map(team => (
                                    <label key={team} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-amber-600/30 hover:bg-amber-50/20 cursor-pointer transition-all">
                                        <input
                                            type="radio"
                                            name="agentTeam"
                                            value={team}
                                            checked={selectedAgentTeam === team}
                                            onChange={e => setSelectedAgentTeam(e.target.value)}
                                            className="w-5 h-5 accent-amber-600"
                                        />
                                        <div>
                                            <div className="font-bold text-[#101418] text-sm">{team} Team</div>
                                            <div className="text-xs text-[#44546f]">
                                                {team === 'IT' ? 'Can manage IT infrastructure tasks' : 'Can manage HR, Admin, and Training tasks'}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                                <label className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all">
                                    <input
                                        type="radio"
                                        name="agentTeam"
                                        value=""
                                        checked={selectedAgentTeam === ''}
                                        onChange={e => setSelectedAgentTeam('')}
                                        className="w-5 h-5 accent-gray-400"
                                    />
                                    <div>
                                        <div className="font-bold text-[#101418] text-sm">No Team Assignment</div>
                                        <div className="text-xs text-[#44546f]">Agent has no task restrictions (admin override)</div>
                                    </div>
                                </label>
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button onClick={() => setShowAgentTeamModal(false)} className="flex-1 py-4 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">Cancel</button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await apiClient.put(`/users/${roleModalUser.id}`, { agentTeam: selectedAgentTeam || null });
                                            setShowAgentTeamModal(false);
                                            await fetchUsers(userPagination.page);
                                        } catch (err: any) {
                                            alert(err.response?.data?.message || 'Failed to assign agent team');
                                        }
                                    }}
                                    className="flex-1 py-4 bg-amber-600 text-white font-black rounded-3xl hover:bg-amber-700 transition-all text-xs uppercase tracking-widest"
                                >Assign Team</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Configuration Tab */}
            {activeTab === 'workflow-config' && (
                <div>
                    <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-200">
                        <h3 className="text-lg font-black text-[#0052cc] mb-2">Workflow Configuration</h3>
                        <p className="text-sm text-[#44546f]">Configure which request types require manager approval and which are handled directly by agents.</p>
                    </div>

                    {workflowLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin"><span className="material-symbols-outlined">hourglass_top</span></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {workflowServiceDesks.map((desk: any) => (
                                <div key={desk.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                        <h4 className="font-black text-[#101418]">{desk.name}</h4>
                                    </div>
                                    <div className="divide-y divide-gray-200">
                                        {desk.categories && desk.categories.map((cat: any) => (
                                            <div key={cat.id} className="p-6">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <span className="material-symbols-outlined text-xl">{cat.icon || 'folder'}</span>
                                                    <div>
                                                        <h5 className="font-bold text-[#101418]">{cat.name}</h5>
                                                        <p className="text-xs text-[#44546f]">{cat.description}</p>
                                                    </div>
                                                </div>
                                                {cat.requestTypes && cat.requestTypes.length > 0 ? (
                                                    <div className="ml-10 space-y-3">
                                                        {cat.requestTypes.map((type: any) => (
                                                            <div key={type.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="material-symbols-outlined text-lg">{type.icon || 'description'}</span>
                                                                    <div>
                                                                        <h6 className="font-bold text-sm text-[#101418]">{type.name}</h6>
                                                                        <p className="text-xs text-[#44546f]">{type.description}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${type.requiresApproval ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                        {type.requiresApproval ? 'Requires Approval' : 'Simple Support'}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => handleWorkflowToggle(type.id, type.requiresApproval)}
                                                                        disabled={workflowSaving === type.id}
                                                                        className={`relative w-12 h-6 rounded-full transition-all ${type.requiresApproval ? 'bg-amber-600' : 'bg-emerald-600'} ${workflowSaving === type.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                    >
                                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${type.requiresApproval ? 'right-1' : 'left-1'}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-[#44546f] ml-10">No request types found</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Toast */}
            {toastMsg && (
                <div className={`fixed bottom-6 right-6 z-[90] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white font-bold text-sm transition-all ${toastMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
                    <span className="material-symbols-outlined text-xl">{toastMsg.type === 'error' ? 'error' : 'check_circle'}</span>
                    {toastMsg.text}
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
