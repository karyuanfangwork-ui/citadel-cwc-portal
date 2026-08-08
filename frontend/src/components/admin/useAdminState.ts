/**
 * Custom hook for Admin Settings state management
 * Encapsulates all useState declarations and handler functions
 * Returns a clean interface for tab and modal components
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { serviceDeskService } from '../../services/serviceDesk.service';
import { adminService, CategoryData } from '../../services/admin.service';
import workflowService, { WorkflowType } from '../../services/workflow.service';
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

export interface DeskFormData {
    name: string;
    code: string;
    description: string;
    isActive: boolean;
    autoAssignTeam: string;
    assignmentStrategy: string;
    autoAssignUserId: string | null;
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
    categorySearch: string;
    setCategorySearch: (search: string) => void;
    filteredCategories: any[];
    loading: boolean;
    desksLoading: boolean;
    desksError: string | null;
    categoriesLoading: boolean;
    categoriesError: string | null;
    requestTypesLoading: boolean;
    requestTypesError: string | null;
    selectedCategory: any;
    requestTypes: any[];
    requestTypeSearch: string;
    setRequestTypeSearch: (search: string) => void;
    requestTypeStatusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE';
    setRequestTypeStatusFilter: (filter: 'ALL' | 'ACTIVE' | 'INACTIVE') => void;
    requestTypeLifecycleFilter: 'ALL' | 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'RETIRED';
    setRequestTypeLifecycleFilter: (filter: 'ALL' | 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'RETIRED') => void;
    filteredRequestTypes: any[];
    formData: CategoryData;
    editingCategory: any;
    modalOpen: boolean;
    deskModalOpen: boolean;
    editingDesk: any | null;
    deskFormData: DeskFormData;
    availableAgents: Array<{ id: string; firstName: string; lastName: string; email: string; agentTeam: string | null; openRequestCount: number }>;
    agentsLoading: boolean;
    agentsError: string | null;
    loadAgentsForDesk: (deskId: string) => Promise<void>;
    loadAgentsForTeam: (team: string) => Promise<void>;

    // Services
    serviceModalOpen: boolean;
    serviceFormData: ServiceFormData;
    editingService: any | null;
    selectedType: any;
    formBuilderOpen: boolean;
    catalogDetailOpen: boolean; // P5-03
    editingTypeName: { id: string; name: string; description: string; workflowTypeId?: string } | null;
    editTypeForm: { name: string; description: string; workflowTypeId: string; slaHours: string };
    savingTypeName: boolean;
    workflowTypes: WorkflowType[];
    workflowTypesLoading: boolean;

    // Users
    users: any[];
    userPagination: UserPagination;
    userStats: { total: number; active: number; disabled: number; agents: number };
    userSearch: string;
    userRoleFilter: string;
    userStatusFilter: '' | 'active' | 'disabled';
    confirmDisableUser: any | null;
    setConfirmDisableUser: (user: any | null) => void;
    availableRoles: { id: string; name: string; description: string }[];
    usersLoading: boolean;
    roleModalUser: any;
    roleModalSelected: string[];
    showAgentTeamModal: boolean;
    selectedAgentTeam: string;
    showCreateUserModal: boolean;
    showImportStaffModal: boolean;
    showEditUserModal: boolean;
    editingUser: any;
    departments: string[];
    resetPasswordUser: any | null;

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
    deactivationImpact: any | null;
    toastMsg: ToastMessage | null;

    // Service Desk Handlers
    fetchServiceDesks: () => Promise<void>;
    fetchWorkflowTypes: () => Promise<void>;
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
    handleUpdateService: (e: React.FormEvent) => Promise<void>;
    handleDeleteService: (typeId: string) => void;
    handleReactivateService: (typeId: string) => void;
    openEditServiceModal: (type: any) => void;
    openFormBuilder: (type: any) => void;
    openCatalogDetail: (type: any) => void; // P5-03
    handleSaveFormConfig: (fields: any[]) => Promise<void>;
    openEditTypeName: (type: any) => void;
    handleSaveTypeName: () => Promise<void>;

    // Service Desk CRUD Handlers
    openAddDeskModal: () => void;
    openEditDeskModal: (desk: any) => void;
    handleSaveDesk: (e: React.FormEvent) => Promise<void>;
    handleDeleteDesk: (deskId: string) => void;
    handleReactivateDesk: (deskId: string) => void;

    // User Handlers
    fetchUsers: (page?: number, search?: string, roleFilter?: string, statusFilter?: '' | 'active' | 'disabled') => Promise<void>;
    fetchUserStats: () => Promise<void>;
    setUserStatusFilter: (v: '' | 'active' | 'disabled') => void;
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
    setShowImportStaffModal: (show: boolean) => void;
    setShowEditUserModal: (show: boolean) => void;
    setEditingUser: (user: any) => void;
    setResetPasswordUser: (user: any | null) => void;
    setFormData: (data: CategoryData) => void;
    setServiceFormData: (data: ServiceFormData) => void;
    setEditingService: (service: any | null) => void;
    setDeskModalOpen: (open: boolean) => void;
    setEditingDesk: (desk: any | null) => void;
    setDeskFormData: (data: DeskFormData) => void;
    setDesksLoading: (loading: boolean) => void;
    setCategoriesLoading: (loading: boolean) => void;
    setRequestTypesLoading: (loading: boolean) => void;
    setTemplateForm: (form: TemplateForm) => void;
    setShowTemplateForm: (show: boolean) => void;
    setOffboardingTemplateForm: (form: OffboardingTemplateForm) => void;
    setShowOffboardingTemplateForm: (show: boolean) => void;
    setPendingAction: (action: PendingAction | null) => void;
    setDeactivationImpact: (impact: any | null) => void;
    setEditTypeForm: (form: { name: string; description: string; workflowTypeId: string; slaHours: string }) => void;
    setEditingTypeName: (type: { id: string; name: string; description: string } | null) => void;
    setFormBuilderOpen: (open: boolean) => void;
    setCatalogDetailOpen: (open: boolean) => void; // P5-03
}

export function filterRequestTypes(
    requestTypes: any[],
    search: string,
    status: 'ALL' | 'ACTIVE' | 'INACTIVE',
    lifecycle: 'ALL' | 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'RETIRED',
) {
    const normalizedSearch = search.trim().toLowerCase();
    return requestTypes.filter(type => {
        const matchesSearch = !normalizedSearch || [type.name, type.description, type.code]
            .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
        const matchesStatus = status === 'ALL'
            || (status === 'ACTIVE' ? type.isActive !== false : type.isActive === false);
        const matchesLifecycle = lifecycle === 'ALL' || type.lifecycleStatus === lifecycle;
        return matchesSearch && matchesStatus && matchesLifecycle;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminState(): UseAdminStateReturn {
    const { user, logout } = useAuth();

    // ── Service Desks State ────────────────────────────────────────────────
    const [serviceDesks, setServiceDesks] = useState<any[]>([]);
    const [selectedDesk, setSelectedDesk] = useState<any>(null);
    const selectedDeskIdRef = useRef<string | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [desksLoading, setDesksLoading] = useState(false);
    const [desksError, setDesksError] = useState<string | null>(null);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoriesError, setCategoriesError] = useState<string | null>(null);
    const [requestTypesLoading, setRequestTypesLoading] = useState(false);
    const [requestTypesError, setRequestTypesError] = useState<string | null>(null);
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

    // ── Service Desk Modal State ───────────────────────────────────────────
    const [deskModalOpen, setDeskModalOpen] = useState(false);
    const [editingDesk, setEditingDesk] = useState<any | null>(null);
    const [deskFormData, setDeskFormData] = useState<DeskFormData>({
        name: '',
        code: '',
        description: '',
        isActive: true,
        autoAssignTeam: 'NONE',
        assignmentStrategy: 'ROUND_ROBIN',
        autoAssignUserId: null,
    });
    const [categorySearch, setCategorySearch] = useState('');
    const [requestTypeSearch, setRequestTypeSearch] = useState('');
    const [requestTypeStatusFilter, setRequestTypeStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [requestTypeLifecycleFilter, setRequestTypeLifecycleFilter] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'RETIRED'>('ALL');

    // ── Agent list for fixed-assignment dropdown ──
    const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; agentTeam: string | null; openRequestCount: number }>>([]);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [agentsError, setAgentsError] = useState<string | null>(null);

    // ── Computed: filtered categories by search ──
    const filteredCategories = useMemo(() => {
        if (!categorySearch.trim()) return categories;
        const search = categorySearch.toLowerCase().trim();
        return categories.filter(cat => cat.name?.toLowerCase().includes(search));
    }, [categories, categorySearch]);

    const filteredRequestTypes = useMemo(
        () => filterRequestTypes(requestTypes, requestTypeSearch, requestTypeStatusFilter, requestTypeLifecycleFilter),
        [requestTypes, requestTypeSearch, requestTypeStatusFilter, requestTypeLifecycleFilter],
    );

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
    const [editingService, setEditingService] = useState<any | null>(null);
    const [selectedType, setSelectedType] = useState<any>(null);
    const [formBuilderOpen, setFormBuilderOpen] = useState(false);
    const [catalogDetailOpen, setCatalogDetailOpen] = useState(false); // P5-03
    const [editingTypeName, setEditingTypeName] = useState<{ id: string; name: string; description: string; workflowTypeId?: string } | null>(null);
    const [editTypeForm, setEditTypeForm] = useState({ name: '', description: '', workflowTypeId: '', slaHours: '' });
    const [savingTypeName, setSavingTypeName] = useState(false);
    const [workflowTypes, setWorkflowTypes] = useState<WorkflowType[]>([]);
    const [workflowTypesLoading, setWorkflowTypesLoading] = useState(false);

    // ── Users State ────────────────────────────────────────────────────────
    const [users, setUsers] = useState<any[]>([]);
    const [userPagination, setUserPagination] = useState<UserPagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
    const [userStats, setUserStats] = useState({ total: 0, active: 0, disabled: 0, agents: 0 });
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('');
    const [userStatusFilter, setUserStatusFilter] = useState<'' | 'active' | 'disabled'>('');
    const [confirmDisableUser, setConfirmDisableUser] = useState<any | null>(null);
    const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string; description: string }[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [roleModalUser, setRoleModalUser] = useState<any | null>(null);
    const [roleModalSelected, setRoleModalSelected] = useState<string[]>([]);
    const [showAgentTeamModal, setShowAgentTeamModal] = useState(false);
    const [selectedAgentTeam, setSelectedAgentTeam] = useState<string>('');
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showImportStaffModal, setShowImportStaffModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);

    // ── Computed: departments from existing users ──
    const departments = useMemo(() => {
        const deptSet = new Set<string>();
        users.forEach(u => { if (u.department) deptSet.add(u.department); });
        return Array.from(deptSet).sort();
    }, [users]);

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
    const [deactivationImpact, setDeactivationImpact] = useState<any | null>(null);
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
        setDesksLoading(true);
        setDesksError(null);
        try {
            setLoading(true);
            // P2-01: Use admin endpoint so inactive desks are visible for restoration
            const desks = await serviceDeskService.getAllServiceDesksAdmin();
            setServiceDesks(desks);
            if (desks.length > 0) {
                const preferredDesk = desks.find((desk: any) => desk.id === selectedDeskIdRef.current) || desks[0];
                selectedDeskIdRef.current = preferredDesk.id;
                setSelectedDesk(preferredDesk);
                fetchCategories(preferredDesk.id);
            } else {
                selectedDeskIdRef.current = null;
                setSelectedDesk(null);
            }
        } catch (err) {
            console.error('Error fetching service desks:', err);
            setDesksError('Failed to load service desks. Please try again.');
        } finally {
            setLoading(false);
            setDesksLoading(false);
        }
    }, []);

    const fetchWorkflowTypes = useCallback(async () => {
        setWorkflowTypesLoading(true);
        try {
            const workflows = await workflowService.getWorkflowTypes();
            setWorkflowTypes(workflows);
        } catch (err) {
            console.error('Error fetching workflow types:', err);
        } finally {
            setWorkflowTypesLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async (deskId: string) => {
        setCategoriesLoading(true);
        setCategoriesError(null);
        try {
            const cats = await serviceDeskService.getAllCategoriesAdmin(deskId);
            setCategories(cats);
        } catch (err) {
            console.error('Error fetching categories:', err);
            setCategoriesError('Failed to load categories. Please try again.');
        } finally {
            setCategoriesLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async (page = 1, search = '', roleFilter = '', statusFilter: '' | 'active' | 'disabled' = '') => {
        setUsersLoading(true);
        try {
            const isActive = statusFilter === 'active' ? true : statusFilter === 'disabled' ? false : undefined;
            const result = await adminService.listUsers({ page, limit: 15, search: search || undefined, role: roleFilter || undefined, isActive });
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

    const fetchUserStats = useCallback(async () => {
        try {
            const [allRes, activeRes, disabledRes, agentRes] = await Promise.all([
                adminService.listUsers({ page: 1, limit: 1 }),
                adminService.listUsers({ page: 1, limit: 1, isActive: true }),
                adminService.listUsers({ page: 1, limit: 1, isActive: false }),
                adminService.listUsers({ page: 1, limit: 1, role: 'AGENT' }),
            ]);
            setUserStats({
                total: allRes.pagination.total,
                active: activeRes.pagination.total,
                disabled: disabledRes.pagination.total,
                agents: agentRes.pagination.total,
            });
        } catch {
            // stats are non-critical, silently ignore
        }
    }, []);

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
            // P1-03: Use admin endpoint so DRAFT/unpublished types appear in workflow config
            const desks = await serviceDeskService.getAllServiceDesksAdmin();
            const desksWithTypes = await Promise.all(
                desks.map(async (desk: any) => {
                    const categoriesWithTypes = await Promise.all(
                        (desk.categories || []).map(async (cat: any) => {
                            const types = await serviceDeskService.getAllRequestTypesAdmin(desk.id, cat.id);
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
        if (!desk) return;
        selectedDeskIdRef.current = desk.id;
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
        // P2-06: Trim and validate before submission
        const trimmedName = formData.name?.trim();
        if (!trimmedName) {
            showToast('error', 'Category name is required.');
            return;
        }

        const trimmedData = {
            ...formData,
            name: trimmedName,
            description: formData.description?.trim() || undefined,
        };

        try {
            if (editingCategory) {
                await serviceDeskService.updateCategory(selectedDesk.id, editingCategory.id, trimmedData);
            } else {
                await serviceDeskService.createCategory(selectedDesk.id, trimmedData);
            }
            setModalOpen(false);
            fetchCategories(selectedDesk.id);
            showToast('success', editingCategory ? 'Category updated.' : 'Category created.');
        } catch (err) {
            console.error('Error saving category:', err);
            showToast('error', 'Failed to save. Ensure the category name is unique for this service desk.');
        }
    }, [selectedDesk, editingCategory, formData, fetchCategories, showToast]);

    const handleDelete = useCallback(async (catId: string) => {
        if (!selectedDesk) return;
        try {
            const impact = await serviceDeskService.getCategoryDeactivationImpact(selectedDesk.id, catId);
            setDeactivationImpact(impact);
        } catch {
            setDeactivationImpact(null);
            showToast('error', 'Unable to load deactivation impact. Nothing was changed.');
            return;
        }
        setPendingAction({
            message: 'Deactivate this category? It will be hidden from users but can be restored.',
            onConfirm: async () => {
                if (!selectedDesk) return;
                await serviceDeskService.deleteCategory(selectedDesk.id, catId);
                fetchCategories(selectedDesk.id);
                showToast('success', 'Category deactivated.');
                setDeactivationImpact(null);
            },
        });
    }, [selectedDesk, fetchCategories, showToast]);

    const handleReactivate = useCallback((catId: string) => {
        setPendingAction({
            message: 'Reactivate this category? It will become visible to users again.',
            onConfirm: async () => {
                if (!selectedDesk) return;
                await serviceDeskService.updateCategory(selectedDesk.id, catId, { isActive: true });
                fetchCategories(selectedDesk.id);
                showToast('success', 'Category reactivated.');
            },
        });
    }, [selectedDesk, fetchCategories, showToast]);

    // ── Load agents for fixed-assignment dropdown ──
    const loadAgentsForDesk = useCallback(async (deskId: string) => {
        setAgentsLoading(true);
        setAgentsError(null);
        try {
            const data = await serviceDeskService.getServiceDeskAgents(deskId);
            setAvailableAgents(data.agents || []);
        } catch (err) {
            console.error('Error loading agents for desk:', err);
            setAvailableAgents([]);
            setAgentsError('Unable to load eligible agents. Please try again.');
        } finally {
            setAgentsLoading(false);
        }
    }, []);

    const loadAgentsForTeam = useCallback(async (team: string) => {
        if (!team || team === 'NONE') {
            setAvailableAgents([]);
            setAgentsError(null);
            return;
        }
        setAgentsLoading(true);
        setAgentsError(null);
        try {
            const data = await serviceDeskService.getServiceDeskAgentsByTeam(team);
            setAvailableAgents(data.agents || []);
        } catch (err) {
            console.error('Error loading agents for team:', err);
            setAvailableAgents([]);
            setAgentsError('Unable to load eligible agents. Please try again.');
        } finally {
            setAgentsLoading(false);
        }
    }, []);

    // ───────────────────────────────────────────────────────────────────────
    // Service Desk CRUD Handlers
    // ───────────────────────────────────────────────────────────────────────

    const openAddDeskModal = useCallback(() => {
        setEditingDesk(null);
        setDeskFormData({
            name: '',
            code: '',
            description: '',
            isActive: true,
            autoAssignTeam: 'NONE',
            assignmentStrategy: 'ROUND_ROBIN',
            autoAssignUserId: null,
        });
        setDeskModalOpen(true);
    }, []);

    const openEditDeskModal = useCallback((desk: any) => {
        setEditingDesk(desk);
        setDeskFormData({
            name: desk.name || '',
            code: desk.code || '',
            description: desk.description || '',
            isActive: desk.isActive !== false,
            autoAssignTeam: desk.autoAssignTeam || 'NONE',
            assignmentStrategy: desk.assignmentStrategy || 'ROUND_ROBIN',
            autoAssignUserId: desk.autoAssignUserId || null,
        });
        // Load agents for the fixed-assignment dropdown when editing
        if (desk.id && desk.autoAssignTeam && desk.autoAssignTeam !== 'NONE') {
            loadAgentsForDesk(desk.id);
        } else {
            setAvailableAgents([]);
            setAgentsError(null);
        }
        setDeskModalOpen(true);
    }, [loadAgentsForDesk]);

    const handleSaveDesk = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        // P2-06: Trim and validate before submission
        const trimmedName = deskFormData.name?.trim();
        if (!trimmedName) {
            showToast('error', 'Service desk name is required.');
            return;
        }
        try {
            if (editingDesk) {
                await serviceDeskService.updateServiceDesk(editingDesk.id, {
                    name: trimmedName,
                    description: deskFormData.description?.trim() || undefined,
                    isActive: deskFormData.isActive,
                    autoAssignTeam: deskFormData.autoAssignTeam?.trim() || undefined,
                    assignmentStrategy: deskFormData.assignmentStrategy,
                    autoAssignUserId: deskFormData.autoAssignTeam === 'NONE' ? null : deskFormData.autoAssignUserId,
                });
            } else {
                const trimmedCode = deskFormData.code?.trim();
                if (!trimmedCode || trimmedCode.length < 3) {
                    showToast('error', 'Code must be at least 3 characters (uppercase letters, numbers, underscores).');
                    return;
                }
                await serviceDeskService.createServiceDesk({
                    name: trimmedName,
                    code: trimmedCode,
                    description: deskFormData.description?.trim() || undefined,
                    autoAssignTeam: deskFormData.autoAssignTeam?.trim() || undefined,
                    assignmentStrategy: deskFormData.assignmentStrategy,
                    autoAssignUserId: deskFormData.autoAssignTeam === 'NONE' ? null : deskFormData.autoAssignUserId,
                });
            }
            setDeskModalOpen(false);
            await fetchServiceDesks();
            showToast('success', editingDesk ? 'Service desk updated.' : 'Service desk created.');
        } catch (err) {
            console.error('Error saving service desk:', err);
            showToast('error', 'Failed to save service desk. Check that the code is unique.');
        }
    }, [editingDesk, deskFormData, fetchServiceDesks, showToast]);

    const handleDeleteDesk = useCallback(async (deskId: string) => {
        try {
            const impact = await serviceDeskService.getDeskDeactivationImpact(deskId);
            setDeactivationImpact(impact);
        } catch {
            setDeactivationImpact(null);
            showToast('error', 'Unable to load deactivation impact. Nothing was changed.');
            return;
        }
        setPendingAction({
            message: 'Delete this service desk? It will be soft-deleted and can be restored later.',
            onConfirm: async () => {
                await serviceDeskService.deleteServiceDesk(deskId);
                await fetchServiceDesks();
                showToast('success', 'Service desk deleted.');
                setDeactivationImpact(null);
            },
        });
    }, [fetchServiceDesks, showToast]);

    const handleReactivateDesk = useCallback((deskId: string) => {
        setPendingAction({
            message: 'Reactivate this service desk? It will become available again.',
            onConfirm: async () => {
                await serviceDeskService.updateServiceDesk(deskId, { isActive: true });
                await fetchServiceDesks();
                showToast('success', 'Service desk reactivated.');
            },
        });
    }, [fetchServiceDesks, showToast]);

    const handleMoveCategory = useCallback(async (cat: any, direction: 'up' | 'down') => {
        if (!selectedDesk) return;
        const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
        const idx = sorted.findIndex(c => c.id === cat.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const reordered = [...sorted];
        const [moved] = reordered.splice(idx, 1);
        reordered.splice(swapIdx, 0, moved);
        try {
            const updated = await serviceDeskService.reorderCategories(selectedDesk.id, reordered.map((category: any) => category.id));
            setCategories(updated);
        } catch (err) {
            console.error('Error reordering category:', err);
            showToast('error', 'Failed to reorder categories.');
        }
    }, [selectedDesk, categories, showToast]);

    const handleManageTypes = useCallback(async (cat: any) => {
        if (selectedCategory?.id === cat.id) {
            setSelectedCategory(null);
            return;
        }
        setSelectedCategory(cat);
        setRequestTypesLoading(true);
        setRequestTypesError(null);
        try {
            const types = await serviceDeskService.getAllRequestTypesAdmin(selectedDesk.id, cat.id);
            setRequestTypes(types);
        } catch (err) {
            console.error('Error fetching request types:', err);
            setRequestTypesError('Failed to load services. Please try again.');
        } finally {
            setRequestTypesLoading(false);
        }
    }, [selectedDesk, selectedCategory]);

    const handleCreateService = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDesk || !selectedCategory) return;
        // P2-06: Trim and validate before submission
        const trimmedName = serviceFormData.name?.trim();
        if (!trimmedName) {
            showToast('error', 'Service name is required.');
            return;
        }
        const slaHours = serviceFormData.slaHours ? parseInt(serviceFormData.slaHours) : null;
        if (slaHours !== null && slaHours <= 0) {
            showToast('error', 'SLA hours must be a positive number.');
            return;
        }
        try {
            await serviceDeskService.createRequestType({
                categoryId: selectedCategory.id,
                name: trimmedName,
                description: serviceFormData.description?.trim() || undefined,
                icon: serviceFormData.icon,
                requiresApproval: serviceFormData.requiresApproval,
                slaHours,
                requiredRole: serviceFormData.requiredRole?.trim() || null,
            });
            setServiceModalOpen(false);
            setServiceFormData({ name: '', description: '', icon: 'bolt', requiresApproval: false, slaHours: '', requiredRole: '' });
            // P1-03 fix: Use admin endpoint so DRAFT services remain visible after create
            const types = await serviceDeskService.getAllRequestTypesAdmin(selectedDesk.id, selectedCategory.id);
            setRequestTypes(types);
            showToast('success', 'Service created.');
        } catch (err) {
            console.error('Error creating service:', err);
            showToast('error', 'Failed to create service.');
        }
    }, [selectedDesk, selectedCategory, serviceFormData, showToast]);

    const handleDeleteService = useCallback(async (typeId: string) => {
        // P2-04: Fetch impact data before confirming
        try {
            const impact = await serviceDeskService.getRequestTypeDeactivationImpact(typeId);
            setDeactivationImpact(impact);
        } catch { /* impact preview is best-effort */ }
        setPendingAction({
            message: 'Deactivate this service? It will be hidden from users but can be restored.',
            onConfirm: async () => {
                await serviceDeskService.deleteRequestType(typeId);
                if (selectedCategory) {
                    const types = await serviceDeskService.getAllRequestTypesAdmin(selectedDesk.id, selectedCategory.id);
                    setRequestTypes(types);
                }
                showToast('success', 'Service deactivated.');
                setDeactivationImpact(null);
            },
        });
    }, [selectedDesk, selectedCategory, showToast]);

    const handleReactivateService = useCallback((typeId: string) => {
        setPendingAction({
            message: 'Reactivate this service? It will become available to users again.',
            onConfirm: async () => {
                await serviceDeskService.updateRequestType(typeId, { isActive: true });
                if (selectedCategory) {
                    const types = await serviceDeskService.getAllRequestTypesAdmin(selectedDesk.id, selectedCategory.id);
                    setRequestTypes(types);
                }
                showToast('success', 'Service reactivated.');
            },
        });
    }, [selectedDesk, selectedCategory, showToast]);

    const openEditServiceModal = useCallback((type: any) => {
        setEditingService(type);
        setServiceFormData({
            name: type.name,
            description: type.description || '',
            icon: type.icon || 'bolt',
            requiresApproval: type.requiresApproval || false,
            slaHours: type.slaHours != null ? String(type.slaHours) : '',
            requiredRole: type.requiredRole || '',
        });
        if (availableRoles.length === 0) fetchRoles();
        setServiceModalOpen(true);
    }, [availableRoles.length, fetchRoles]);

    const handleUpdateService = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingService) return;
        // P2-06: Trim and validate before submission
        const trimmedName = serviceFormData.name?.trim();
        if (!trimmedName) {
            showToast('error', 'Service name is required.');
            return;
        }
        const slaHours = serviceFormData.slaHours ? parseInt(serviceFormData.slaHours) : null;
        if (slaHours !== null && slaHours <= 0) {
            showToast('error', 'SLA hours must be a positive number.');
            return;
        }
        try {
            await serviceDeskService.updateRequestType(editingService.id, {
                name: trimmedName,
                description: serviceFormData.description?.trim() || undefined,
                icon: serviceFormData.icon,
                requiresApproval: serviceFormData.requiresApproval,
                slaHours,
                requiredRole: serviceFormData.requiredRole?.trim() || null,
            });
            setServiceModalOpen(false);
            setEditingService(null);
            setServiceFormData({ name: '', description: '', icon: 'bolt', requiresApproval: false, slaHours: '', requiredRole: '' });
            if (selectedCategory) {
                const types = await serviceDeskService.getAllRequestTypesAdmin(selectedDesk.id, selectedCategory.id);
                setRequestTypes(types);
            }
            showToast('success', 'Service updated.');
        } catch (err) {
            console.error('Error updating service:', err);
            showToast('error', 'Failed to update service.');
        }
    }, [editingService, serviceFormData, selectedDesk, selectedCategory, showToast]);

    const openFormBuilder = useCallback((type: any) => {
        setSelectedType(type);
        setFormBuilderOpen(true);
    }, []);

    const openCatalogDetail = useCallback((type: any) => { // P5-03
        setSelectedType(type);
        setCatalogDetailOpen(true);
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
                // P1-03 fix: Use admin endpoint so DRAFT services remain visible after form save
                const types = await serviceDeskService.getAllRequestTypesAdmin(selectedDesk.id, selectedCategory.id);
                setRequestTypes(types);
            }
        } catch (err) {
            console.error('Error saving form config:', err);
            showToast('error', 'Failed to save form configuration.');
        }
    }, [selectedType, selectedDesk, selectedCategory, showToast]);

    const openEditTypeName = useCallback((type: any) => {
        setEditingTypeName({ id: type.id, name: type.name, description: type.description || '', workflowTypeId: type.workflowTypeId });
        setEditTypeForm({ name: type.name, description: type.description || '', workflowTypeId: type.workflowTypeId || '', slaHours: type.slaHours != null ? String(type.slaHours) : '' });
    }, []);

    const handleSaveTypeName = useCallback(async () => {
        if (!editingTypeName) return;
        setSavingTypeName(true);
        try {
            await serviceDeskService.updateRequestType(editingTypeName.id, {
                name: editTypeForm.name,
                description: editTypeForm.description,
                workflowTypeId: editTypeForm.workflowTypeId || null,
                slaHours: editTypeForm.slaHours ? parseInt(editTypeForm.slaHours, 10) : null,
            });
            setRequestTypes(prev => prev.map(t =>
                t.id === editingTypeName.id ? { ...t, name: editTypeForm.name, description: editTypeForm.description, workflowTypeId: editTypeForm.workflowTypeId, slaHours: editTypeForm.slaHours ? parseInt(editTypeForm.slaHours, 10) : null } : t
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
            fetchUserStats();
            showToast('success', `Account ${!user.isActive ? 'enabled' : 'disabled'}.`);
        } catch (err) {
            console.error('Error toggling user status:', err);
            showToast('error', 'Failed to update account status.');
        }
    }, [userPagination.page, fetchUsers, fetchUserStats, showToast]);

    const handleEditUser = useCallback(async (data: any) => {
        if (!editingUser) return;
        await adminService.updateUser(editingUser.id, data);
        fetchUsers(userPagination.page);
        showToast('success', 'User updated successfully.');
    }, [editingUser, userPagination.page, fetchUsers, showToast]);

    const handleSaveRoles = useCallback(async () => {
        if (!roleModalUser) return;
        if (roleModalSelected.length === 0) {
            showToast('error', 'A user must have at least one role.');
            return;
        }
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
        fetchWorkflowTypes();
    }, [fetchServiceDesks, fetchWorkflowTypes]);

    useEffect(() => {
        if (activeTab === 'onboarding-tasks') {
            fetchTemplates();
        } else if (activeTab === 'offboarding-tasks') {
            fetchOffboardingTemplates();
        } else if (activeTab === 'users' || activeTab === 'entities') {
            fetchUsers(1, '', '');
            fetchUserStats();
            fetchRoles();
        } else if (activeTab === 'workflow-config') {
            fetchWorkflowConfig();
        }
    }, [activeTab, fetchTemplates, fetchOffboardingTemplates, fetchUsers, fetchUserStats, fetchRoles, fetchWorkflowConfig]);

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
        categorySearch,
        setCategorySearch,
        filteredCategories,
        loading,
        desksLoading,
        desksError,
        categoriesLoading,
        categoriesError,
        requestTypesLoading,
        requestTypesError,
        selectedCategory,
        requestTypes,
        requestTypeSearch,
        setRequestTypeSearch,
        requestTypeStatusFilter,
        setRequestTypeStatusFilter,
        requestTypeLifecycleFilter,
        setRequestTypeLifecycleFilter,
        filteredRequestTypes,
        formData,
        editingCategory,
        modalOpen,
        deskModalOpen,
        editingDesk,
        deskFormData,
        availableAgents,
        agentsLoading,
        agentsError,
        loadAgentsForDesk,
        loadAgentsForTeam,

        // Services
        serviceModalOpen,
        serviceFormData,
        editingService,
        selectedType,
        formBuilderOpen,
        catalogDetailOpen,
        editingTypeName,
        editTypeForm,
        savingTypeName,
        workflowTypes,
        workflowTypesLoading,

        // Users
        users,
        userPagination,
        userStats,
        userSearch,
        userRoleFilter,
        userStatusFilter,
        confirmDisableUser,
        setConfirmDisableUser,
        availableRoles,
        usersLoading,
        roleModalUser,
        roleModalSelected,
        showAgentTeamModal,
        selectedAgentTeam,
        showCreateUserModal,
        showImportStaffModal,
        showEditUserModal,
        editingUser,
        departments,
        resetPasswordUser,

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
        deactivationImpact,
        toastMsg,

        // Handlers
        fetchServiceDesks,
        fetchWorkflowTypes,
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
        handleUpdateService,
        handleDeleteService,
        handleReactivateService,
        openEditServiceModal,
        openFormBuilder,
        openCatalogDetail,
        handleSaveFormConfig,
        openEditTypeName,
        handleSaveTypeName,

        // Service Desk CRUD Handlers
        openAddDeskModal,
        openEditDeskModal,
        handleSaveDesk,
        handleDeleteDesk,
        handleReactivateDesk,

        fetchUsers,
        fetchUserStats,
        fetchRoles,
        setUserStatusFilter,
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
        setShowImportStaffModal,
        setShowEditUserModal,
        setEditingUser,
        setResetPasswordUser,
        setFormData,
        setServiceFormData,
        setEditingService,
        setDeskModalOpen,
        setEditingDesk,
        setDeskFormData,
        setDesksLoading,
        setCategoriesLoading,
        setRequestTypesLoading,
        setTemplateForm,
        setShowTemplateForm,
        setOffboardingTemplateForm,
        setShowOffboardingTemplateForm,
        setPendingAction,
        setDeactivationImpact,
        setEditTypeForm,
        setEditingTypeName,
        setFormBuilderOpen,
        setCatalogDetailOpen,
    };
}
