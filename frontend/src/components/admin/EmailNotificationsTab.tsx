import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminService, NotificationTemplate, EventTypeInfo } from '../../services/admin.service';

// ── Category badge colors ───────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    General: 'bg-blue-50 text-blue-700 border-blue-200',
    Auth: 'bg-slate-50 text-slate-700 border-slate-200',
    'IT Workflow': 'bg-purple-50 text-purple-700 border-purple-200',
    Finance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Chargeback: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    SLA: 'bg-red-50 text-red-700 border-red-200',
};

const DEFAULT_COLOR = 'bg-gray-50 text-gray-700 border-gray-200';

// ── Helper: strip HTML to plain preview text ────────────────────────
function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export const EmailNotificationsTab: React.FC = () => {
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [eventTypes, setEventTypes] = useState<EventTypeInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'unconfigured' | 'disabled'>('all');
    const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
    const [editingEventType, setEditingEventType] = useState<EventTypeInfo | null>(null);
    const [saving, setSaving] = useState(false);
    const [sendingTest, setSendingTest] = useState<string | null>(null);
    const [globalEmailEnabled, setGlobalEmailEnabled] = useState<boolean>(true);
    const [togglingGlobal, setTogglingGlobal] = useState(false);

    // ── Form state for modal ────────────────────────────────────────
    const [formSubject, setFormSubject] = useState('');
    const [formBody, setFormBody] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);

    const showToast = useCallback((type: 'success' | 'error', text: string) => {
        setToastMsg({ type, text });
        setTimeout(() => setToastMsg(null), 4000);
    }, []);

    // ── Fetch data ──────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [tpls, evts, emailEnabled] = await Promise.all([
                adminService.listNotificationTemplates(),
                adminService.listEventTypes(),
                adminService.getEmailNotificationsEnabled(),
            ]);
            setTemplates(tpls);
            setEventTypes(evts);
            setGlobalEmailEnabled(emailEnabled);
        } catch (err: any) {
            setError(err.message || 'Failed to load notification data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Build merged view: event types + their template (if any) ────
    const templateMap = useMemo(() => {
        const map: Record<string, NotificationTemplate> = {};
        for (const t of templates) map[t.eventType] = t;
        return map;
    }, [templates]);

    const categories = useMemo(() => {
        const cats = new Set(eventTypes.map(e => e.category));
        return Array.from(cats).sort();
    }, [eventTypes]);

    const filteredEventTypes = useMemo(() => {
        return eventTypes.filter(evt => {
            const tpl = templateMap[evt.eventType];
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!evt.label.toLowerCase().includes(q) && !evt.eventType.toLowerCase().includes(q) && !evt.category.toLowerCase().includes(q)) return false;
            }
            if (categoryFilter && evt.category !== categoryFilter) return false;
            if (statusFilter === 'configured' && !tpl) return false;
            if (statusFilter === 'unconfigured' && tpl) return false;
            if (statusFilter === 'disabled' && (!tpl || tpl.isActive)) return false;
            return true;
        });
    }, [eventTypes, templateMap, searchQuery, categoryFilter, statusFilter]);

    // Group by category
    const groupedEvents = useMemo(() => {
        const groups: Record<string, typeof filteredEventTypes> = {};
        for (const evt of filteredEventTypes) {
            if (!groups[evt.category]) groups[evt.category] = [];
            groups[evt.category].push(evt);
        }
        return groups;
    }, [filteredEventTypes]);

    // ── Toggle active/inactive ──────────────────────────────────────
    const handleToggle = useCallback(async (tpl: NotificationTemplate) => {
        try {
            const updated = await adminService.updateNotificationTemplate(tpl.id, { isActive: !tpl.isActive });
            setTemplates(prev => prev.map(t => t.id === tpl.id ? updated : t));
            showToast('success', `Email ${updated.isActive ? 'enabled' : 'disabled'} for ${tpl.eventType}`);
        } catch {
            showToast('error', 'Failed to toggle template status');
        }
    }, [showToast]);

    // ── Global email toggle ─────────────────────────────────────────
    const handleGlobalToggle = useCallback(async () => {
        setTogglingGlobal(true);
        try {
            const newValue = await adminService.setEmailNotificationsEnabled(!globalEmailEnabled);
            setGlobalEmailEnabled(newValue);
            showToast('success', newValue ? 'All email notifications enabled' : 'All email notifications paused');
        } catch {
            showToast('error', 'Failed to update global email setting');
        } finally {
            setTogglingGlobal(false);
        }
    }, [globalEmailEnabled, showToast]);

    // ── Open edit modal ─────────────────────────────────────────────
    const openEditor = useCallback((evt: EventTypeInfo) => {
        const tpl = templateMap[evt.eventType];
        setEditingEventType(evt);
        if (tpl) {
            setEditingTemplate(tpl);
            setFormSubject(tpl.emailSubject || '');
            setFormBody(tpl.emailBody ? stripHtml(tpl.emailBody) : '');
            setFormIsActive(tpl.isActive);
        } else {
            setEditingTemplate(null);
            setFormSubject(`Notification: ${evt.label} — Request #{{requestId}}`);
            setFormBody(`Hello {{userName}},\n\nThis is a notification for ${evt.label} on request #{{requestId}}.\n\nPlease visit the portal to view the details.`);
            setFormIsActive(true);
        }
    }, [templateMap]);

    const closeEditor = useCallback(() => {
        setEditingEventType(null);
        setEditingTemplate(null);
    }, []);

    // ── Save template ───────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!editingEventType) return;
        setSaving(true);
        try {
            // Convert plain text body to simple HTML paragraphs
            const htmlBody = formBody
                .split('\n')
                .map(line => line.trim() ? `<p>${line}</p>` : '')
                .filter(Boolean)
                .join('\n');

            if (editingTemplate) {
                const updated = await adminService.updateNotificationTemplate(editingTemplate.id, {
                    emailSubject: formSubject,
                    emailBody: htmlBody,
                    isActive: formIsActive,
                });
                setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
            } else {
                const name = editingEventType.eventType.toLowerCase().replace(/_/g, '_');
                const created = await adminService.createNotificationTemplate({
                    name,
                    eventType: editingEventType.eventType,
                    emailSubject: formSubject,
                    emailBody: htmlBody,
                    isActive: formIsActive,
                });
                setTemplates(prev => [...prev, created]);
            }
            showToast('success', 'Template saved successfully');
            closeEditor();
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    }, [editingEventType, editingTemplate, formSubject, formBody, formIsActive, showToast, closeEditor]);

    // ── Send test email ─────────────────────────────────────────────
    const handleSendTest = useCallback(async (templateId: string) => {
        setSendingTest(templateId);
        try {
            const result = await adminService.sendTestEmail(templateId);
            showToast('success', result.message || 'Test email sent');
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Failed to send test email');
        } finally {
            setSendingTest(null);
        }
    }, [showToast]);

    // ── Loading/Error states ────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <span className="animate-spin material-symbols-outlined text-3xl text-[#0052cc]">progress_activity</span>
                <span className="ml-3 text-[#44546f] font-medium">Loading notification templates…</span>
            </div>
        );
    }
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                <p className="text-red-700 font-medium mt-2">{error}</p>
                <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors">Retry</button>
            </div>
        );
    }

    const configuredCount = eventTypes.filter(e => templateMap[e.eventType]).length;
    const activeCount = templates.filter(t => t.isActive).length;

    return (
        <div className="space-y-5">
            {/* Master email toggle */}
            <div className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${globalEmailEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-300'}`}>
                <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-2xl ${globalEmailEnabled ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {globalEmailEnabled ? 'mark_email_read' : 'mail_off'}
                    </span>
                    <div>
                        <p className={`text-sm font-black ${globalEmailEnabled ? 'text-emerald-900' : 'text-amber-900'}`}>
                            {globalEmailEnabled ? 'Email Notifications Active' : 'Email Notifications Paused'}
                        </p>
                        <p className={`text-xs mt-0.5 ${globalEmailEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {globalEmailEnabled
                                ? 'All configured email notifications will be sent normally.'
                                : 'No email notifications are being sent system-wide, regardless of individual template settings.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleGlobalToggle}
                    disabled={togglingGlobal}
                    className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${globalEmailEnabled ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    title={globalEmailEnabled ? 'Pause all emails' : 'Enable all emails'}
                >
                    {togglingGlobal ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-sm animate-spin">progress_activity</span>
                        </span>
                    ) : (
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${globalEmailEnabled ? 'left-8' : 'left-1'}`} />
                    )}
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-blue-600">mail</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-[#101418]">{eventTypes.length}</p>
                            <p className="text-xs text-[#44546f] font-medium">Event Types</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-[#101418]">{configuredCount}</p>
                            <p className="text-xs text-[#44546f] font-medium">Configured</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-green-600">toggle_on</span>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-[#101418]">{activeCount}</p>
                            <p className="text-xs text-[#44546f] font-medium">Active</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters row */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#8993a4] text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Search event types…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                            />
                        </div>
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                    >
                        <option value="all">All Statuses</option>
                        <option value="configured">Configured</option>
                        <option value="unconfigured">Unconfigured</option>
                        <option value="disabled">Disabled</option>
                    </select>
                </div>
            </div>

            {/* Event types grouped by category */}
            {Object.keys(groupedEvents).length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                    <span className="material-symbols-outlined text-4xl text-[#8993a4]">search_off</span>
                    <p className="text-[#44546f] font-medium mt-2">No event types match your filters</p>
                </div>
            ) : (
                Object.entries(groupedEvents).map(([category, events]) => (
                    <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Category header */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${CATEGORY_COLORS[category] || DEFAULT_COLOR}`}>{category}</span>
                            <span className="text-xs text-[#8993a4] font-medium">({events.length} event{events.length !== 1 ? 's' : ''})</span>
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-gray-50">
                            {events.map(evt => {
                                const tpl = templateMap[evt.eventType];
                                return (
                                    <div key={evt.eventType} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                        {/* Status dot */}
                                        <div className="flex-shrink-0">
                                            {tpl ? (
                                                <div className={`w-2.5 h-2.5 rounded-full ${tpl.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} title={tpl.isActive ? 'Active' : 'Disabled'} />
                                            ) : (
                                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" title="Unconfigured" />
                                            )}
                                        </div>
                                        {/* Event info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-[#101418]">{evt.label}</span>
                                                {!tpl && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">No Template</span>}
                                                {tpl && !tpl.isActive && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Disabled</span>}
                                            </div>
                                            <p className="text-xs text-[#8993a4] mt-0.5 font-mono">{evt.eventType}</p>
                                            <p className="text-xs text-[#44546f] mt-0.5">→ {evt.recipientDescription}</p>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {tpl && (
                                                <>
                                                    {/* Toggle */}
                                                    <button
                                                        onClick={() => handleToggle(tpl)}
                                                        className={`relative w-10 h-5 rounded-full transition-colors ${tpl.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                        title={tpl.isActive ? 'Disable' : 'Enable'}
                                                    >
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${tpl.isActive ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                                                    </button>
                                                    {/* Test email */}
                                                    <button
                                                        onClick={() => handleSendTest(tpl.id)}
                                                        disabled={!!sendingTest}
                                                        className="p-2 text-[#44546f] hover:text-[#0052cc] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Send test email"
                                                    >
                                                        <span className={`material-symbols-outlined text-lg ${sendingTest === tpl.id ? 'animate-spin' : ''}`}>
                                                            {sendingTest === tpl.id ? 'progress_activity' : 'send'}
                                                        </span>
                                                    </button>
                                                </>
                                            )}
                                            {/* Edit */}
                                            <button
                                                onClick={() => openEditor(evt)}
                                                className="p-2 text-[#44546f] hover:text-[#0052cc] hover:bg-blue-50 rounded-lg transition-colors"
                                                title={tpl ? 'Edit template' : 'Create template'}
                                            >
                                                <span className="material-symbols-outlined text-lg">{tpl ? 'edit' : 'add_circle'}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}

            {/* ── Edit / Create Modal ────────────────────────────────────── */}
            {editingEventType && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
                        {/* Modal header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-[#101418]">
                                    {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${CATEGORY_COLORS[editingEventType.category] || DEFAULT_COLOR}`}>
                                        {editingEventType.category}
                                    </span>
                                    <span className="text-xs text-[#8993a4] font-mono">{editingEventType.eventType}</span>
                                </div>
                            </div>
                            <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={saving}>
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-8 py-6 overflow-y-auto flex-1 space-y-5">
                            {/* Active toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="text-sm font-bold text-[#101418]">Email Enabled</p>
                                    <p className="text-xs text-[#44546f]">When disabled, this event will not send email notifications</p>
                                </div>
                                <button
                                    onClick={() => setFormIsActive(!formIsActive)}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${formIsActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${formIsActive ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-bold text-[#101418] mb-2">Email Subject</label>
                                <input
                                    type="text"
                                    value={formSubject}
                                    onChange={e => setFormSubject(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                    placeholder="e.g. Request #{{requestId}} — Status Updated"
                                    disabled={saving}
                                />
                                <p className="text-xs text-[#8993a4] mt-1">Use {"{{variableName}}"} to insert dynamic values</p>
                            </div>

                            {/* Body */}
                            <div>
                                <label className="block text-sm font-bold text-[#101418] mb-2">Email Body (Plain Text)</label>
                                <textarea
                                    value={formBody}
                                    onChange={e => setFormBody(e.target.value)}
                                    rows={8}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none resize-none font-mono leading-relaxed"
                                    placeholder={"Hello {{userName}},\n\nYour request #{{requestId}} has been updated.\n\nPlease visit the portal to view the details."}
                                    disabled={saving}
                                />
                                <p className="text-xs text-[#8993a4] mt-1">Each line becomes a paragraph. The email will be wrapped in the branded Citadel layout automatically.</p>
                            </div>

                            {/* Available variables */}
                            <div>
                                <label className="block text-sm font-bold text-[#101418] mb-2">Available Variables</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {editingEventType.availableVariables.map(v => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => {
                                                // Copy to clipboard for easy paste
                                                navigator.clipboard.writeText(`{{${v}}}`);
                                                showToast('success', `Copied {{${v}}} to clipboard`);
                                            }}
                                            className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-mono rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                                            title={`Click to copy {{${v}}}`}
                                        >
                                            {`{{${v}}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Recipient info */}
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-600 text-lg">info</span>
                                    <p className="text-sm text-blue-800 font-medium">
                                        Recipient: <span className="font-bold">{editingEventType.recipientDescription}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                {editingTemplate && (
                                    <button
                                        onClick={() => handleSendTest(editingTemplate.id)}
                                        disabled={!!sendingTest || saving}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <span className={`material-symbols-outlined text-lg ${sendingTest === editingTemplate.id ? 'animate-spin' : ''}`}>
                                            {sendingTest === editingTemplate.id ? 'progress_activity' : 'send'}
                                        </span>
                                        Send Test Email
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={closeEditor}
                                    disabled={saving}
                                    className="px-6 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formSubject.trim()}
                                    className="px-6 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-xl hover:bg-[#0043a8] transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? (
                                        <><span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>Saving…</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-lg">save</span>Save Template</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ──────────────────────────────────────────────────── */}
            {toastMsg && (
                <div className={`fixed bottom-6 right-6 z-[90] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white font-bold text-sm transition-all ${toastMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
                    <span className="material-symbols-outlined text-xl">{toastMsg.type === 'error' ? 'error' : 'check_circle'}</span>
                    {toastMsg.text}
                </div>
            )}
        </div>
    );
};
