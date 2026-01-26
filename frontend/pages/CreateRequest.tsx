import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { requestService } from '../src/services/request.service';
import { serviceDeskService } from '../src/services/serviceDesk.service';

const CreateRequest = () => {
    const { deskId, categoryId, deskType } = useParams<{ deskId: string; categoryId: string; deskType: string }>();
    const navigate = useNavigate();

    const [requestTypes, setRequestTypes] = useState<any[]>([]);
    const [selectedRequestType, setSelectedRequestType] = useState<any>(null);
    const [category, setCategory] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<any>({
        summary: '',
        description: '',
        urgency: 'MEDIUM',
        component: '',
        customFields: {}
    });

    const URGENCY_OPTIONS = [
        { value: 'LOW', label: 'Low - General inquiry or minor issue' },
        { value: 'MEDIUM', label: 'Medium - Significant issue for a single user' },
        { value: 'HIGH', label: 'High - Significant issue for multiple users' },
        { value: 'CRITICAL', label: 'Critical - System wide issue or total work stoppage' },
    ];

    const COMPONENT_OPTIONS = [
        'Connect',
        'Hardware',
        'Software',
        'Service',
        'Access',
    ];

    const KB_ARTICLES = [
        { title: 'How to reset your corporate VPN', excerpt: 'Follow these steps if you\'re unable to establish a secure connection or lost your credentials...' },
        { title: 'Setting up MFA for the first time', excerpt: 'Multi-factor authentication is required for all internal tools. Learn how to configure your...' },
        { title: 'Common connection error codes', excerpt: 'A glossary of common error codes (403, 502, etc.) and what they mean for your setup.' },
    ];

    useEffect(() => {
        if (deskId && categoryId) {
            fetchData();
        }
    }, [deskId, categoryId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const cats = await serviceDeskService.getCategories(deskId!);
            const currentCat = cats.find((c: any) => c.id === categoryId);
            setCategory(currentCat || null);

            const types = await serviceDeskService.getRequestTypes(deskId!, categoryId);

            if (types && types.length > 0) {
                setRequestTypes(types);

                // Auto-select first type if only one exists
                if (types.length === 1) {
                    handleRequestTypeChange(types[0]);
                }
            } else {
                setError('No active request types found for this category.');
            }
        } catch (err: any) {
            console.error('Error fetching request data:', err);
            setError('Failed to initialize request form.');
        } finally {
            setLoading(false);
        }
    };

    const getDeskName = () => {
        switch (deskType) {
            case 'it': return 'IT Support';
            case 'hr': return 'HR Services';
            case 'finance': return 'Group Finance';
            default: return 'Service Desk';
        }
    };

    const handleRequestTypeChange = (type: any) => {
        setSelectedRequestType(type);

        // Initialize custom fields for the selected type
        const initialCustom: any = {};
        if (type.formConfig) {
            type.formConfig.forEach((field: any) => {
                initialCustom[field.id] = '';
            });
        }
        setFormData(prev => ({
            ...prev,
            customFields: initialCustom,
            summary: '',
            description: ''
        }));
    };

    const handleCustomFieldChange = (fieldId: string, value: string) => {
        setFormData({
            ...formData,
            customFields: {
                ...formData.customFields,
                [fieldId]: value
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deskId || !selectedRequestType) return;

        try {
            setSubmitting(true);
            setError(null);

            const request = await requestService.createRequest({
                serviceDeskId: deskId,
                requestTypeId: selectedRequestType.id,
                summary: formData.summary,
                description: formData.description,
                priority: formData.urgency as any,
                customFields: {
                    ...formData.customFields,
                    component: formData.component
                }
            });

            navigate(`/request/${request.id}`);
        } catch (err: any) {
            console.error('Error creating request:', err);
            setError(err.response?.data?.message || 'Failed to create request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderDynamicField = (field: any) => {
        const commonClass = "w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none transition-all placeholder:text-gray-400";

        switch (field.type) {
            case 'textarea':
                return (
                    <textarea
                        required={field.required}
                        rows={4}
                        className={`${commonClass} resize-none`}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        value={formData.customFields[field.id] || ''}
                        onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                        disabled={submitting}
                    />
                );
            case 'date':
                return (
                    <input
                        required={field.required}
                        type="date"
                        className={commonClass}
                        value={formData.customFields[field.id] || ''}
                        onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                        disabled={submitting}
                    />
                );
            case 'number':
                return (
                    <input
                        required={field.required}
                        type="number"
                        className={commonClass}
                        placeholder="0"
                        value={formData.customFields[field.id] || ''}
                        onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                        disabled={submitting}
                    />
                );
            case 'file':
                return (
                    <div className="relative">
                        <input
                            required={field.required}
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            className="hidden"
                            id={`file-${field.id}`}
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    handleCustomFieldChange(field.id, file.name);
                                }
                            }}
                            disabled={submitting}
                        />
                        <label
                            htmlFor={`file-${field.id}`}
                            className="flex items-center justify-center gap-3 w-full px-4 py-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[#0052cc] hover:bg-blue-50/30 transition-all cursor-pointer group"
                        >
                            <span className="material-symbols-outlined text-3xl text-gray-400 group-hover:text-[#0052cc]">upload_file</span>
                            <div className="text-left">
                                <p className="text-sm font-bold text-[#101418] group-hover:text-[#0052cc]">
                                    {formData.customFields[field.id] || 'Click to upload or drag and drop'}
                                </p>
                                <p className="text-xs text-[#5e718d]">PNG, JPG, PDF, DOC (max 10MB)</p>
                            </div>
                        </label>
                    </div>
                );
            default: // text
                return (
                    <input
                        required={field.required}
                        type="text"
                        className={commonClass}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        value={formData.customFields[field.id] || ''}
                        onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                        disabled={submitting}
                    />
                );
        }
    };

    if (loading) {
        return (
            <div className="max-w-[1240px] mx-auto px-6 py-12 flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1240px] mx-auto px-6 py-12">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 mb-8 text-sm font-medium text-[#5e718d]">
                <Link to="/" className="hover:text-[#0052cc]">Help Center</Link>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <Link to={`/${deskType}`} className="hover:text-[#0052cc]">{getDeskName()}</Link>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
                <span className="text-[#101418] font-bold">{category?.name || 'Get help'}</span>
            </nav>

            {/* Header */}
            <div className="mb-10">
                <h1 className="text-4xl font-bold text-[#101418] mb-2">
                    {category?.name || 'Get help'}
                </h1>
                <p className="text-[#5e718d] text-lg">
                    Tell us what you need help with and we'll get back to you as soon as possible.
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-10">
                {/* Main Form Area */}
                <div className="flex-grow lg:max-w-[800px]">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-t-4 border-t-[#0052cc]/10">
                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Request Type Selector - Only show if multiple types exist */}
                            {requestTypes.length > 1 && (
                                <div className="pb-6 border-b border-gray-100">
                                    <label className="block text-sm font-bold text-[#101418] mb-3">
                                        Select Request Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {requestTypes.map((type) => (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => handleRequestTypeChange(type)}
                                                className={`p-5 rounded-xl border-2 text-left transition-all ${selectedRequestType?.id === type.id
                                                    ? 'border-[#0052cc] bg-blue-50/50 shadow-md'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedRequestType?.id === type.id
                                                        ? 'bg-[#0052cc] text-white'
                                                        : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        <span className="material-symbols-outlined text-xl">{type.icon || 'mail'}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-[#101418] mb-1">{type.name}</h3>
                                                        <p className="text-xs text-[#5e718d] leading-relaxed">{type.description}</p>
                                                    </div>
                                                    {selectedRequestType?.id === type.id && (
                                                        <span className="material-symbols-outlined text-[#0052cc]">check_circle</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {!selectedRequestType && (
                                        <p className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                                            ⚠️ Please select a request type to continue
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Only show form fields if a request type is selected */}
                            {selectedRequestType && (
                                <>
                                    {/* Summary */}
                                    <div>
                                        <label className="block text-sm font-bold text-[#101418] mb-2 flex justify-between">
                                            Summary <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g.. VPN won't connect"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none transition-all placeholder:text-gray-400"
                                            value={formData.summary}
                                            onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                            disabled={submitting}
                                        />
                                    </div>

                                    {/* Component - Only for IT Support */}
                                    {deskType === 'it' && (
                                        <div>
                                            <label className="block text-sm font-bold text-[#101418] mb-2 flex justify-between">
                                                Component <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    required
                                                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none transition-all appearance-none text-[#101418]"
                                                    value={formData.component}
                                                    onChange={e => setFormData({ ...formData, component: e.target.value })}
                                                    disabled={submitting}
                                                >
                                                    <option value="" disabled>Select a component</option>
                                                    {COMPONENT_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* DYNAMIC FIELDS FROM ADMIN CONFIG */}
                                    {selectedRequestType?.formConfig?.map((field: any) => (
                                        <div key={field.id} className="scale-in">
                                            <label className="block text-sm font-bold text-[#101418] mb-2 flex justify-between">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {renderDynamicField(field)}
                                        </div>
                                    ))}

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-bold text-[#101418] mb-2">Description</label>
                                        <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0052cc]/20 focus-within:border-[#0052cc] transition-all">
                                            <div className="bg-gray-50/50 border-b border-gray-100 px-4 py-2 flex gap-4">
                                                <button type="button" className="material-symbols-outlined text-gray-500 hover:text-[#0052cc] text-lg">format_bold</button>
                                                <button type="button" className="material-symbols-outlined text-gray-500 hover:text-[#0052cc] text-lg">format_italic</button>
                                                <button type="button" className="material-symbols-outlined text-gray-500 hover:text-[#0052cc] text-lg">format_list_bulleted</button>
                                                <button type="button" className="material-symbols-outlined text-gray-500 hover:text-[#0052cc] text-lg">link</button>
                                            </div>
                                            <textarea
                                                rows={8}
                                                placeholder="Include any error codes or steps to reproduce..."
                                                className="w-full px-4 py-3 bg-white border-none text-base outline-none resize-none placeholder:text-gray-400"
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                disabled={submitting}
                                            />
                                        </div>
                                    </div>

                                    {/* Urgency */}
                                    <div>
                                        <label className="block text-sm font-bold text-[#101418] mb-2">Urgency</label>
                                        <div className="relative">
                                            <select
                                                className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none transition-all appearance-none text-[#101418]"
                                                value={formData.urgency}
                                                onChange={e => setFormData({ ...formData, urgency: e.target.value })}
                                                disabled={submitting}
                                            >
                                                {URGENCY_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-6 flex items-center gap-6">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-10 py-3 bg-[#0052cc] text-white font-bold rounded-lg hover:bg-[#0747a6] transition-all shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-70"
                                        >
                                            {submitting ? 'Sending...' : 'Send Request'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate(-1)}
                                            className="px-6 py-3 text-[#5e718d] font-bold hover:text-[#101418] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:w-[360px] space-y-8">
                    {/* Knowledge Base */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 text-[#0052cc] mb-6">
                            <span className="material-symbols-outlined">menu_book</span>
                            <h3 className="font-bold text-lg text-[#101418]">Knowledge Base</h3>
                        </div>

                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-6">
                            <p className="text-sm text-[#0052cc] leading-relaxed">
                                Start typing your summary to see related help articles in real-time.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {KB_ARTICLES.map((article, i) => (
                                <div key={i} className="group cursor-pointer">
                                    <h4 className="font-bold text-[#101418] group-hover:text-[#0052cc] transition-colors mb-1">{article.title}</h4>
                                    <p className="text-xs text-[#5e718d] line-clamp-2 leading-normal">{article.excerpt}</p>
                                </div>
                            ))}
                        </div>

                        <button className="w-full mt-8 py-3 border border-gray-200 rounded-lg text-sm font-bold text-[#101418] hover:bg-gray-50 transition-colors">
                            Search full knowledge base
                        </button>
                    </div>

                    {/* Immediate Help */}
                    <div className="bg-[#091e42] rounded-2xl p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">Need immediate help?</h3>
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                Our IT support chat is available 24/7 for urgent technical issues.
                            </p>
                            <button className="w-full py-3 bg-white text-[#091e42] font-bold rounded-lg hover:bg-gray-100 transition-colors">
                                Start Live Chat
                            </button>
                        </div>
                        {/* Decorative element */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateRequest;
