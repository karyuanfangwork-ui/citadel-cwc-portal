import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { EscalationRole, EscalationRule, serviceDeskService } from '../../services/serviceDesk.service';
import { ConfirmDialog, EscalationOverviewTable, EscalationRuleForm, EscalationRuleRow, SlaContextBanner, SlaPauseConfig } from './sla-escalation';

interface ServiceDesk { id: string; name: string; code?: string }
interface Category { id: string; name: string; serviceDeskId: string }
interface RequestType { id: string; name: string; slaHours: number | null }

function errorMessage(error: unknown, fallback: string) {
    const response = (error as { response?: { data?: { message?: string } } })?.response;
    return response?.data?.message || fallback;
}

export function SLAEscalationTab() {
    const [desks, setDesks] = useState<ServiceDesk[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
    const [roles, setRoles] = useState<EscalationRole[]>([]);
    const [overviewRules, setOverviewRules] = useState<any[]>([]);
    const [rules, setRules] = useState<EscalationRule[]>([]);
    const [selectedDeskId, setSelectedDeskId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [view, setView] = useState<'overview' | 'detail'>('overview');
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState('');
    const [deleteRule, setDeleteRule] = useState<EscalationRule | null>(null);
    const rulesSectionRef = useRef<HTMLDivElement>(null);

    const announce = useCallback((message: string, isError = false) => { if (isError) setError(message); else setSuccess(message); }, []);
    const loadOverview = useCallback(async () => { setLoadingOverview(true); try { setOverviewRules(await serviceDeskService.getEscalationRulesOverview()); } catch (err) { setError(errorMessage(err, 'Failed to load escalation overview.')); } finally { setLoadingOverview(false); } }, []);
    const loadRules = useCallback(async (typeId: string) => { if (!typeId) { setRules([]); return; } try { setRules(await serviceDeskService.getEscalationRules(typeId)); } catch (err) { setError(errorMessage(err, 'Failed to load escalation rules.')); } }, []);

    useEffect(() => { serviceDeskService.getAllServiceDesks().then(setDesks).catch(() => setError('Failed to load service desks.')); adminService.listRoles().then(setRoles).catch(() => setError('Failed to load available roles.')); loadOverview(); }, [loadOverview]);
    useEffect(() => { if (!selectedDeskId) { setCategories([]); return; } serviceDeskService.getCategories(selectedDeskId).then(setCategories).catch(() => setCategories([])); }, [selectedDeskId]);
    useEffect(() => { if (!selectedDeskId || !selectedCategoryId) { setRequestTypes([]); return; } serviceDeskService.getRequestTypes(selectedDeskId, selectedCategoryId).then(setRequestTypes).catch(() => setRequestTypes([])); }, [selectedDeskId, selectedCategoryId]);
    useEffect(() => { loadRules(selectedTypeId); }, [selectedTypeId, loadRules]);
    useEffect(() => { if (!success) return; const timer = window.setTimeout(() => setSuccess(''), 3000); return () => window.clearTimeout(timer); }, [success]);

    const selectedType = requestTypes.find(type => type.id === selectedTypeId) || overviewRules.find(rule => rule.requestTypeId === selectedTypeId)?.requestType || null;
    const ruleCount = rules.length;
    const roleNames = useMemo(() => roles.map(role => role.name), [roles]);
    const openDetail = (deskId: string, categoryId: string, typeId: string) => { setSelectedDeskId(deskId); setSelectedCategoryId(categoryId); setSelectedTypeId(typeId); setView('detail'); window.setTimeout(() => rulesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };
    const selectOverviewRule = (rule: any) => openDetail(rule.requestType.serviceCategory.serviceDesk.id, rule.requestType.serviceCategory.id, rule.requestType.id);
    const refresh = async () => { await loadRules(selectedTypeId); await loadOverview(); };
    const addRule = async (data: { triggerHoursAfterBreach: number; notifyRoles: string[]; label?: string }) => { setSaving(true); setError(null); try { await serviceDeskService.createEscalationRule({ requestTypeId: selectedTypeId, ...data }); setShowAddForm(false); await refresh(); announce('Escalation rule created.'); } catch (err) { setError(errorMessage(err, 'Failed to create escalation rule.')); } finally { setSaving(false); } };
    const editRule = async (rule: EscalationRule, data: { triggerHoursAfterBreach: number; notifyRoles: string[]; label?: string }) => { setSaving(true); setError(null); try { await serviceDeskService.updateEscalationRule(rule.id, data); setEditingRuleId(null); await refresh(); announce('Escalation rule updated.'); } catch (err) { setError(errorMessage(err, 'Failed to update escalation rule.')); } finally { setSaving(false); } };
    const toggleRule = async (rule: EscalationRule) => { try { await serviceDeskService.updateEscalationRule(rule.id, { isActive: !rule.isActive }); await refresh(); announce(rule.isActive ? 'Rule disabled.' : 'Rule activated.'); } catch (err) { setError(errorMessage(err, 'Failed to update rule.')); } };
    const confirmDelete = async () => { if (!deleteRule) return; try { await serviceDeskService.deleteEscalationRule(deleteRule.id); setDeleteRule(null); await refresh(); announce('Rule deleted.'); } catch (err) { setError(errorMessage(err, 'Failed to delete rule.')); } };

    return <div className="space-y-6"><div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#101418]">SLA Escalation Rules</h2><p className="mt-1 text-sm text-[#44546f]">Configure who is notified when requests exceed their SLA.</p></div><div className="flex rounded-lg border border-gray-200 bg-white p-1"><button type="button" onClick={() => setView('overview')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === 'overview' ? 'bg-[#e8f0fe] text-[#0052cc]' : 'text-[#44546f]'}`}>Overview</button><button type="button" onClick={() => setView('detail')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === 'detail' ? 'bg-[#e8f0fe] text-[#0052cc]' : 'text-[#44546f]'}`}>Detail</button></div></div></div>{success && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><span className="material-symbols-outlined">check_circle</span>{success}</div>}{error && <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><span className="material-symbols-outlined">error</span>{error}<button type="button" onClick={() => setError(null)} className="ml-auto">&times;</button></div>}{view === 'overview' && <EscalationOverviewTable rules={overviewRules} loading={loadingOverview} onSelectRule={selectOverviewRule} />}<section ref={rulesSectionRef} className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><label className="block text-xs font-bold text-[#101418]">Service desk<select value={selectedDeskId} onChange={e => { setSelectedDeskId(e.target.value); setSelectedCategoryId(''); setSelectedTypeId(''); setView('detail'); }} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"><option value="">Select desk...</option>{desks.map(desk => <option key={desk.id} value={desk.id}>{desk.name}</option>)}</select></label><label className="block text-xs font-bold text-[#101418]">Category<select value={selectedCategoryId} disabled={!selectedDeskId} onChange={e => { setSelectedCategoryId(e.target.value); setSelectedTypeId(''); }} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm disabled:bg-gray-50"><option value="">Select category...</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block text-xs font-bold text-[#101418]">Request type<select value={selectedTypeId} disabled={!selectedCategoryId} onChange={e => { setSelectedTypeId(e.target.value); setView('detail'); }} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm disabled:bg-gray-50"><option value="">Select request type...</option>{requestTypes.map(type => <option key={type.id} value={type.id}>{type.name}{type.slaHours == null ? ' (no SLA)' : ` (${type.slaHours}h SLA)`}</option>)}</select></label></div>{selectedTypeId && <><SlaContextBanner requestType={selectedType} ruleCount={ruleCount} /><div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-black text-[#101418]">Rules for {selectedType?.name || 'request type'}</h3><button type="button" onClick={() => { setShowAddForm(true); setEditingRuleId(null); }} className="flex items-center gap-1.5 rounded-lg bg-[#0052cc] px-3 py-2 text-xs font-bold text-white"><span className="material-symbols-outlined text-base">add</span>Add rule</button></div>{rules.length === 0 && !showAddForm && <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm italic text-[#8993a4]">No escalation rules configured for this request type.</div>}{rules.length > 0 && <div className="divide-y overflow-hidden rounded-xl border border-gray-200">{rules.map(rule => <EscalationRuleRow key={rule.id} rule={rule} onEdit={item => { setEditingRuleId(item.id); setShowAddForm(false); }} onToggleActive={toggleRule} onDelete={setDeleteRule} isEditing={editingRuleId === rule.id} editForm={editingRuleId === rule.id ? <EscalationRuleForm mode="edit" initialValues={rule} availableRoles={roles} onSubmit={data => editRule(rule, data)} onCancel={() => setEditingRuleId(null)} saving={saving} error={error} /> : undefined} />)}</div>}{showAddForm && <EscalationRuleForm mode="add" availableRoles={roles} onSubmit={addRule} onCancel={() => setShowAddForm(false)} saving={saving} error={error} />}</div></>}</section><SlaPauseConfig onMessage={announce} /><ConfirmDialog open={Boolean(deleteRule)} title="Delete Escalation Rule" message={deleteRule ? `Are you sure you want to delete the rule that notifies ${deleteRule.notifyRoles.map(role => roleNames.includes(role) ? roles.find(item => item.name === role)?.description || role : role).join(', ')} at +${deleteRule.triggerHoursAfterBreach}h after breach?${deleteRule.label ? ` (${deleteRule.label})` : ''} This action cannot be undone.` : ''} confirmLabel="Delete Rule" onConfirm={confirmDelete} onCancel={() => setDeleteRule(null)} /></div>;
}

export default SLAEscalationTab;
