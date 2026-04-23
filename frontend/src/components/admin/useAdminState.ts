/**
 * Custom hook for Admin Settings state management
 * Encapsulates all useState declarations and handler functions
 * Returns a clean interface for tab and modal components
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { serviceDeskService } from '../../services/serviceDesk.service';
import { adminService, CategoryData } from '../../services/admin.service';
import apiClient from '../../services/api';
import { OnboardingTaskTemplate } from '../../../types';
import { AdminTabId } from './adminConstants';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceFormData {
    name: string;
    description: string;
    icon: string;
    requiresApproval: boolean;
    slaHours: string;
    requiredRole: string;
}

export interface TemplateForm {
    taskName: string;
    taskDescription: string;
    taskCategory: 'IT' | 'HR' | 'TRAINING' | 'ADMIN';
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    dueDayOffset: number;
    displayOrder: number;
}

export interface OffboardingTemplateForm {
    taskName: string;
    taskDescription: string;
    taskCategory: 'IT' | 'HR' | 'ADMIN';
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    dueDayOffset: number;
    displayOrder: number;
}

export interface PendingAction {
    message: string;
    onConfirm: () => Promise<void>;
}

export interface ToastMessage {
    type: 'error' | 'success';
    text: string;
}

export interface UserPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Return Type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAdminStateReturn {
    // Auth
    user: any;
    logout: () => Promise<void>;

    // Service Desks
    serviceDesks: any[];
    selectedDesk: any;
    categories: any[];
    loading: boolean;
    selectedCategory: any;
    requestTypes: any[];
    formData: CategoryData;
    editingCategory: any;
    modalOpen: boolean;

    // Services
    serviceModalOpen: boolean;
    serviceFormData: ServiceFormData;
    selectedType: any;
    formBuilderOpen: boolean;
    editingTypeName: { id: string; name: string; description: string } | null;
    editTypeForm: { name: string; description: string };
    savingTypeName: boolean;

    // Users
    users: any[];
    userPagination: UserPagination;
    userSearch: string;
    userRoleFilter: string;
    availableRoles: { id: string; name: string; description: string }[];
    usersLoading: boolean;
    roleModalUser: any;
    roleModalSelected: string[];
    showAgentTeamModal: boolean;
    selectedAgentTeam: string;
    showCreateUserModal: boolean;
    showEditUserModal: boolean;
    editingUser: any;

    // Onboarding
    templates: OnboardingTaskTemplate[];
    templatesLoading: boolean;
    templateError: string | null;
    editingTemplate: OnboardingTaskTemplate | null;
    showTemplateForm: boolean;
    templateForm: TemplateForm;

    // Offboarding
    offboardingTemplates: OnboardingTaskTemplate[];
    offboardingTemplatesLoading: boolean;
    offboardingTemplateError: string | null;
    editingOffboardingTemplate: OnboardingTaskTemplate | null;
    showOffboardingTemplateForm: boolean;
    offboardingTemplateForm: OffboardingTemplateForm;

    // Workflow
    workflowServiceDesks: any[];
    workflowLoading: boolean;
    workflowSaving: string | null;

    // UI
    activeTab: AdminTabId;
    pendingAction: PendingAction | null;
    toastMsg: ToastMessage | null;

    // Service Desk Handlers
    fetchServiceDesks: () => Promise<void>;
    fetchCategories: (deskId: string) => Promise<void>;
    handleDeskChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    openAddModal: () => void;
    openEditModal: (cat: any) => void;
    handleSave: (e: React.FormEvent) => Promise<void>;
    handleDelete: (catId: string) => void;
    handleReactivate: (catId: string) => void;
    handleMoveCategory: (cat: any, direction: 'up' | 'down') => Promise<void>;
    handleManageTypes: (cat: any) => Promise<void>;
    handleCreateService: (e: React.FormEvent) => Promise<void>;
    handleDeleteService: (typeId: string) => void;
    openFormBuilder: (type: any) => void;
    handleSaveFormConfig: (fields: any[]) => Promise<void>;
    openEditTypeName: (type: any) => void;
    handleSaveTypeName: () => Promise<void>;

    // User Handlers
    fetchUsers: (page?: number, search?: string, roleFilter?: string) => Promise<void>;
    fetchRoles: () => Promise<void>;
    handleToggleUserStatus: (user: any) => Promise<void>;
    handleEditUser: (data: any) => Promise<void>;
    handleSaveRoles: () => Promise<void>;

    // Onboarding Handlers
    fetchTemplates: () => Promise<void>;
    handleSaveTemplate: () => Promise<void>;
    handleDeleteTemplate: (id: string) => Promise<void>;
    handleEditTemplate: (template: OnboardingTaskTemplate) => void;

    // Offboarding Handlers
    fetchOffboardingTemplates: () => Promise<void>;
    handleSaveOffboardingTemplate: () => Promise<void>;
    handleDeleteOffboardingTemplate: (id: string) => Promise<void>;
    handleEditOffboardingTemplate: (template: OnboardingTaskTemplate) => void;

    // Workflow Handlers
    fetchWorkflowConfig: () => Promise<void>;
    handleWorkflowToggle: (typeId: string, currentValue: boolean) => Promise<void>;

    // UI Handlers
    showToast: (type: 'error' | 'success', text: string) => void;
    executePendingAction: () => Promise<void>;

    // Setters for modals and UI state
    setActiveTab: (tab: AdminTabId) => void;
    setModalOpen: (open: boolean) => void;
    setServiceModalOpen: (open: boolean) => void;
    setRoleModalUser: (user: any) => void;
    setRoleModalSelected: (roles: string[]) => void;
    setShowAgentTeamModal: (show: boolean) => void;
    setSelectedAgentTeam: (team: string) => void;
    setShowCreateUserModal: (show: boolean) => void;
    setShowEditUserModal: (show: boolean) => void;
    setEditingUser: (user: any) => void;
    setFormData: (data: CategoryData) => void;
    setServiceFormData: (data: ServiceFormData) => void;
    setTemplateForm: (form: TemplateForm) => void;
    setOffboardingTemplateForm: (form: OffboardingTemplateForm) => void;
    setPendingAction: (action: PendingAction | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminState(): UseAdminStateReturn {
    const { user, logout } = useAuth();

    // ── Service Desks State ────────────────────────────────────────────────
    const [serviceDesks, setServiceDesks] = useState<any[]>([]);
    const [selectedDesk, setSelectedDesk] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [requestTypes, setRequestTypes] = useState<any[]>([]);
    const [formData, setFormData] = useState<CategoryData>({
        name: '',
        description: '',
        icon: 'laptop',
        colorClass: 'bg-blue-50 text-blue-600',
        displayOrder: 0,
        isActive: true,
    });
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // ── Services State ─────────────────────────────────────────────────────
    const [serviceModalOpen, setServiceModalOpen] = useState(false);
    const [serviceFormData, setServiceFormData] = useState<ServiceFormData>({
        name: '',
        description: '',
        icon: 'bolt',
        requiresApproval: false,
        slaHours: '',
        requiredRole: '',
    });
    const [selectedType, setSelectedType] = useState<any>(null);
    const [formBuilderOpen, setFormBuilderOpen] = useState(false);
    const [editingTypeName, setEditingTypeName] = useState<{ id: string; name: string; description: string } | null>(null);
    const [editTypeForm, setEditTypeForm] = useState({ name: '', description: '' });
    const [savingTypeName, setSavingTypeName] = useState(false);

    // ── Users State ────────────────────────────────────────────────────────
    const [users, setUsers] = useState<any[]>([]);
    const [userPagination, setUserPagination] = useState<UserPagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('');
    const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; description: string }[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [roleModalUser, setRoleModalUser] = useState<any | null>(null);
    const [roleModalSelected, setRoleModalSelected] = useState<string[]>([]);
    const [showAgentTeamModal, setShowAgentTeamModal] = useState(false);
    const [selectedAgentTeam, setSelectedAgentTeam] = useState<string>('');
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);

    // ── Onboarding State ───────────────────────────────────────────────────
    const [templates, setTemplates] = useState<OnboardingTaskTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<OnboardingTaskTemplate | null>(null);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [templateForm, setTemplateForm] = useState<TemplateForm>({
        taskName: '',
        taskDescription: '',
        taskCategory: 'IT',
        priority: 'MEDIUM',
        dueDayOffset: 0,
        displayOrder: 0,
    });

    // ── Offboarding State ──────────────────────────────────────────────────
    const [offboardingTemplates, setOffboardingTemplates] = useState<OnboardingTaskTemplate[]>([]);
    const [offboardingTemplatesLoading, setOffboardingTemplatesLoading] = useState(false);
    const [offboardingTemplateError, setOffboardingTemplateError] = useState<string | null>(null);
    const [editingOffboardingTemplate, setEditingOffboardingTemplate] = useState<OnboardingTaskTemplate | null>(null);
    const [showOffboardingTemplateForm, setShowOffboardingTemplateForm] = useState(false);
    const [offboardingTemplateForm, setOffboardingTemplateForm] = useState<OffboardingTemplateForm>({
        taskName: '',
        taskDescription: '',
        taskCategory: 'HR',
        priority: 'MEDIUM',
        dueDayOffset: 0,
        displayOrder: 0,
    });

    // ── Workflow State ─────────────────────────────────────────────────────
    const [workflowServiceDesks, setWorkflowServiceDesks] = useState<any[]>([]);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [workflowSaving, setWorkflowSaving] = useState<string | null>(null);

    // ── UI State ───────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<AdminTabId>('service-desks');
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [toastMsg, setToastMsg] = useState<ToastMessage | null>(null);

    // ───────────────────────────────────────────────────────────────────────
    // Helper Functions
    // ───────────────────────────────────────────────────────────────────────

    const showToast = useCallback((type: 'error' | 'success', text: string) => {
        setToastMsg({ type, text });
        setTimeout(() => setToastMsg(null), 4000);
    }, []);

    const executePendingAction = useCallback(async () => {
        if (!pendingAction) return;
        try {
            await pendingAction.onConfirm();
        } catch (err) {
            console.error('Action failed:', err);
            showToast('error', 'Action failed. Please try again.');
        } finally {
            setPendingAction(null);
        }
    }, [pendingAction, showToast]);

    // ───────────────────────────────────────────────────────────────────────
    // Fetch Functions
    // ───────────────────────────────────────────────────────────────────────

    const fetchServiceDesks = useCallback(async () => {
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
    }, []);

    const fetchCategories = useCallback(async (deskId: string) => {
        try {
            const cats = await adminService.getAllCategoriesAdmin(deskId);
            setCategories(cats);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    }, []);

    const fetchUsers = useCallback(async (page = 1, search = '', roleFilter = '') => {
        setUsersLoading(true);
        try {
            const result = await adminService.listUsers({ page, limit: 15, search: search || undefined, role: roleFilter || undefined });
            setUsers(result.users);
            setUserPagination(result.pagination);
            setUserSearch(search);
            setUserRoleFilter(roleFilter);
        } catch (err) {
            console.error('Error fetching users:', err);
            showToast('error', 'Failed to load users.');
        } finally {
            setUsersLoading(false);
        }
    }, [showToast]);

    const fetchRoles = useCallback(async () => {
        try {
            const roles = await adminService.listRoles();
            setAvailableRoles(roles);
        } catch (err) {
            console.error('Error fetching roles:', err);
        }
    }, []);

    const fetchTemplates = useCallback(async () => {
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
    }, []);

    const fetchOffboardingTemplates = useCallback(async () => {
        setOffboardingTemplatesLoading(true);
        setOffboardingTemplateError(null);
        try {
            const res = await apiClient.get('/admin/offboarding-templates');
            setOffboardingTemplates(res.data.data);
        } catch (err: any) {
            setOffboardingTemplateError(err.message || 'Failed to load templates');
        } finally {
            setOffboardingTemplatesLoading(false);
        }
    }, []);

    const fetchWorkflowConfig = useCallback(async () => {
        setWorkflowLoading(true);
        try {
            const desks = await serviceDeskService.getAllServiceDesks();
            const desksWithTypes = await Promise.all(
                desks.map(async (desk: any) => {
                    const categoriesWithTypes = await Promise.all(
                        (desk.categories || []).map(async (cat: any) => {
                            const types = await serviceDeskService.getRequestTypes(desk.id, cat.id);
                            return { ...cat, requestTypes: types || [] };
                        })
                    );
                    return { ...desk, categories: categoriesWithTypes };
                })
            );
            setWorkflowServiceDesks(desksWithTypes);
        } catch (err: any) {
            showToast('error', 'Failed to load workflow config');
        } finally {
            setWorkflowLoading(false);
        }
    }, [showToast]);

    // ───────────────────────────────────────────────────────────────────────
    // Service Desk Handlers
    // ───────────────────────────────────────────────────────────────────────

    const handleDeskChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const desk = serviceDesks.find(d => d.id === e.target.value);
        setSelectedDesk(desk);
        fetchCategories(desk.id);
        setSelectedCategory(null);
    }, [serviceDesks, fetchCategories]);

    const openAddModal = useCallback(() => {
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
    }, [categories]);

    const openEditModal = useCallback((cat: any) => {
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
    }, []);

    const handleSave = useCallback(async (e: React.FormEvent) => {
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
    }, [selectedDesk, editingCategory, formData, fetchCategories, showToast]);

    const handleDelete = useCallback((catId: string) => {
        setPendingAction({
            message: 'Deactivate this category? It will be hidden from users but can be restored.',
            onConfirm: async () => {
                if (!selectedDesk) return;
                await adminService.deleteCategory(selectedDesk.id, catId);
                fetchCategories(selectedDesk.id);
                showToast('success', 'Category deactivated.');
            },
        });
    }, [selectedDesk, fetchCategories, showToast]);

    const handleReactivate = useCallback((catId: string) => {
        setPendingAction({
            message: 'Reactivate this category? It will become visible to users again.',
            onConfirm: async () => {
                if (!selectedDesk) return;
                await adminService.updateCategory(selectedDesk.id, catId, { isActive: true });
                fetchCategories(selectedDesk.id);
                showToast('success', 'Category reactivated.');
            },
        });
    }, [selectedDesk, fetchCategories, showToast]);

    const handleMoveCategory = useCallback(async (cat: any, direction: 'up' | 'down') => {
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
    }, [selectedDesk, categories, fetchCategories, showToast]);

    const handleManageTypes = useCallback(async (cat: any) => {
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
    }, [selectedDesk, selectedCategory]);

    const handleCreateService = useCallback(async (e: React.FormEvent) => {
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
    }, [selectedDesk, selectedCategory, serviceFormData, showToast]);

    const handleDeleteService = useCallback((typeId: string) => {
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
    }, [selectedDesk, selectedCategory, showToast]);

    const openFormBuilder = useCallback((type: any) => {
        setSelectedType(type);
        setFormBuilderOpen(true);
    }, []);

    const handleSaveFormConfig = useCallback(async (fields: any[]) => {
        if (!selectedType) return;
        try {
            await serviceDeskService.updateRequestType(selectedType.id, {
                formConfig: fields
            });
            showToast('success', 'Form configuration saved successfully.');
            setFormBuilderOpen(false);
            if (selectedCategory) {
                const types = await serviceDeskService.getRequestTypes(selectedDesk.id, selectedCategory.id);
                setRequestTypes(types);
            }
        } catch (err) {
            console.error('Error saving form config:', err);
            showToast('error', 'Failed to save form configuration.');
        }
    }, [selectedType, selectedDesk, selectedCategory, showToast]);

    const openEditTypeName = useCallback((type: any) => {
        setEditingTypeName({ id: type.id, name: type.name, description: type.description || '' });
        setEditTypeForm({ name: type.name, description: type.description || '' });
    }, []);

    const handleSaveTypeName = useCallback(async () => {
        if (!editingTypeName) return;
        setSavingTypeName(true);
        try {
            await serviceDeskService.updateRequestType(editingTypeName.id, {
                name: editTypeForm.name,
                description: editTypeForm.description,
            });
            setRequestTypes(prev => prev.map(t =>
                t.id === editingTypeName.id ? { ...t, name: editTypeForm.name, description: editTypeForm.description } : t
            ));
            showToast('success', 'Request type updated successfully.');
            setEditingTypeName(null);
        } catch (err) {
            showToast('error', 'Failed to update request type.');
        } finally {
            setSavingTypeName(false);
        }
    }, [editingTypeName, editTypeForm, showToast]);

    // ───────────────────────────────────────────────────────────────────────
    // User Handlers
    // ───────────────────────────────────────────────────────────────────────

    const handleToggleUserStatus = useCallback(async (user: any) => {
        try {
            await adminService.updateUser(user.id, { isActive: !user.isActive });
            fetchUsers(userPagination.page);
            showToast('success', `Account ${!user.isActive ? 'enabled' : 'disabled'}.`);
        } catch (err) {
            console.error('Error toggling user status:', err);
            showToast('error', 'Failed to update account status.');
        }
    }, [userPagination.page, fetchUsers, showToast]);

    const handleEditUser = useCallback(async (data: any) => {
        if (!editingUser) return;
        await adminService.updateUser(editingUser.id, data);
        fetchUsers(userPagination.page);
        showToast('success', 'User updated successfully.');
    }, [editingUser, userPagination.page, fetchUsers, showToast]);

    const handleSaveRoles = useCallback(async () => {
        if (!roleModalUser || roleModalSelected.length === 0) return;
        const isSelf = user?.id === roleModalUser.id;
        try {
            await adminService.assignUserRoles(roleModalUser.id, roleModalSelected);
            setRoleModalUser(null);
            if (isSelf) {
                showToast('success', 'Your roles were updated. Please log in again.');
                setTimeout(() => logout(), 1500);
            } else {
                fetchUsers(userPagination.page);
                showToast('success', 'Roles updated. User session revoked — they must log in again.');
            }
        } catch (err) {
            console.error('Error saving roles:', err);
            showToast('error', 'Failed to update roles.');
        }
    }, [roleModalUser, roleModalSelected, user, logout, userPagination.page, fetchUsers, showToast]);

    // ───────────────────────────────────────────────────────────────────────
    // Onboarding Handlers
    // ───────────────────────────────────────────────────────────────────────

    const handleSaveTemplate = useCallback(async () => {
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
    }, [editingTemplate, templateForm]);

    const handleDeleteTemplate = useCallback(async (id: string) => {
        if (!confirm('Delete this template? This will not affect existing onboarding checklists.')) return;
        try {
            await apiClient.delete(`/admin/onboarding-templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            setTemplateError(err.message || 'Failed to delete template');
        }
    }, []);

    const handleEditTemplate = useCallback((template: OnboardingTaskTemplate) => {
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
    }, []);

    // ───────────────────────────────────────────────────────────────────────
    // Offboarding Handlers
    // ───────────────────────────────────────────────────────────────────────

    const handleSaveOffboardingTemplate = useCallback(async () => {
        try {
            if (editingOffboardingTemplate) {
                const res = await apiClient.put(`/admin/offboarding-templates/${editingOffboardingTemplate.id}`, offboardingTemplateForm);
                setOffboardingTemplates(prev => prev.map(t => t.id === editingOffboardingTemplate.id ? res.data : t));
            } else {
                const res = await apiClient.post('/admin/offboarding-templates', offboardingTemplateForm);
                setOffboardingTemplates(prev => [...prev, res.data]);
            }
            setShowOffboardingTemplateForm(false);
            setEditingOffboardingTemplate(null);
            setOffboardingTemplateForm({ taskName: '', taskDescription: '', taskCategory: 'HR', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 0 });
        } catch (err: any) {
            setOffboardingTemplateError(err.message || 'Failed to save template');
        }
    }, [editingOffboardingTemplate, offboardingTemplateForm]);

    const handleDeleteOffboardingTemplate = useCallback(async (id: string) => {
        if (!confirm('Delete this template? This will not affect existing offboarding checklists.')) return;
        try {
            await apiClient.delete(`/admin/offboarding-templates/${id}`);
            setOffboardingTemplates(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            setOffboardingTemplateError(err.message || 'Failed to delete template');
        }
    }, []);

    const handleEditOffboardingTemplate = useCallback((template: OnboardingTaskTemplate) => {
        setEditingOffboardingTemplate(template);
        setOffboardingTemplateForm({
            taskName: template.taskName,
            taskDescription: template.taskDescription || '',
            taskCategory: template.taskCategory as any,
            priority: template.priority as any,
            dueDayOffset: template.dueDayOffset,
            displayOrder: template.displayOrder,
        });
        setShowOffboardingTemplateForm(true);
    }, []);

    // ───────────────────────────────────────────────────────────────────────
    // Workflow Handlers
    // ───────────────────────────────────────────────────────────────────────

    const handleWorkflowToggle = useCallback(async (typeId: string, currentValue: boolean) => {
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
    }, [showToast]);

    // ───────────────────────────────────────────────────────────────────────
    // Effect Hooks
    // ───────────────────────────────────────────────────────────────────────

    useEffect(() => {
        fetchServiceDesks();
    }, [fetchServiceDesks]);

    useEffect(() => {
        if (activeTab === 'onboarding-tasks') {
            fetchTemplates();
        } else if (activeTab === 'offboarding-tasks') {
            fetchOffboardingTemplates();
        } else if (activeTab === 'users') {
            fetchUsers(1, '', '');
            fetchRoles();
        } else if (activeTab === 'workflow-config') {
            fetchWorkflowConfig();
        }
    }, [activeTab, fetchTemplates, fetchOffboardingTemplates, fetchUsers, fetchRoles, fetchWorkflowConfig]);

    // ───────────────────────────────────────────────────────────────────────
    // Return Interface
    // ───────────────────────────────────────────────────────────────────────

    return {
        // Auth
        user,
        logout,

        // Service Desks
        serviceDesks,
        selectedDesk,
        categories,
        loading,
        selectedCategory,
        requestTypes,
        formData,
        editingCategory,
        modalOpen,

        // Services
        serviceModalOpen,
        serviceFormData,
        selectedType,
        formBuilderOpen,
        editingTypeName,
        editTypeForm,
        savingTypeName,

        // Users
        users,
        userPagination,
        userSearch,
        userRoleFilter,
        availableRoles,
        usersLoading,
        roleModalUser,
        roleModalSelected,
        showAgentTeamModal,
        selectedAgentTeam,
        showCreateUserModal,
        showEditUserModal,
        editingUser,

        // Onboarding
        templates,
        templatesLoading,
        templateError,
        editingTemplate,
        showTemplateForm,
        templateForm,

        // Offboarding
        offboardingTemplates,
        offboardingTemplatesLoading,
        offboardingTemplateError,
        editingOffboardingTemplate,
        showOffboardingTemplateForm,
        offboardingTemplateForm,

        // Workflow
        workflowServiceDesks,
        workflowLoading,
        workflowSaving,

        // UI
        activeTab,
        pendingAction,
        toastMsg,

        // Handlers
        fetchServiceDesks,
        fetchCategories,
        handleDeskChange,
        openAddModal,
        openEditModal,
        handleSave,
        handleDelete,
        handleReactivate,
        handleMoveCategory,
        handleManageTypes,
        handleCreateService,
        handleDeleteService,
        openFormBuilder,
        handleSaveFormConfig,
        openEditTypeName,
        handleSaveTypeName,
        fetchUsers,
        fetchRoles,
        handleToggleUserStatus,
        handleEditUser,
        handleSaveRoles,
        fetchTemplates,
        handleSaveTemplate,
        handleDeleteTemplate,
        handleEditTemplate,
        fetchOffboardingTemplates,
        handleSaveOffboardingTemplate,
        handleDeleteOffboardingTemplate,
        handleEditOffboardingTemplate,
        fetchWorkflowConfig,
        handleWorkflowToggle,
        showToast,
        executePendingAction,

        // Setters
        setActiveTab,
        setModalOpen,
        setServiceModalOpen,
        setRoleModalUser,
        setRoleModalSelected,
        setShowAgentTeamModal,
        setSelectedAgentTeam,
        setShowCreateUserModal,
        setShowEditUserModal,
        setEditingUser,
        setFormData,
        setServiceFormData,
        setTemplateForm,
        setOffboardingTemplateForm,
        setPendingAction,
    };
}
