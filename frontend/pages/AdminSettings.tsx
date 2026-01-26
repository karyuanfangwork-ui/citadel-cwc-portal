import React, { useState, useEffect } from 'react';
import { serviceDeskService } from '../src/services/serviceDesk.service';
import { adminService, CategoryData } from '../src/services/admin.service';
import FormBuilder from '../src/components/FormBuilder';

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

    const [formData, setFormData] = useState<CategoryData>({
        name: '',
        description: '',
        icon: 'laptop',
        colorClass: 'bg-blue-50 text-blue-600',
        displayOrder: 0,
        isActive: true,
    });

    useEffect(() => {
        fetchServiceDesks();
    }, []);

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
            const cats = await serviceDeskService.getCategories(deskId);
            setCategories(cats);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
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
        } catch (err) {
            console.error('Error saving category:', err);
            alert('Failed to save category. Please check if the name is unique.');
        }
    };

    const handleDelete = async (catId: string) => {
        if (!selectedDesk || !window.confirm('Are you sure you want to deactivate this category?')) return;

        try {
            await adminService.deleteCategory(selectedDesk.id, catId);
            fetchCategories(selectedDesk.id);
        } catch (err) {
            console.error('Error deleting category:', err);
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
            alert('Form configuration saved successfully!');
            setFormBuilderOpen(false);
            if (selectedCategory) {
                // Refresh request types
                const types = await serviceDeskService.getRequestTypes(selectedDesk.id, selectedCategory.id);
                setRequestTypes(types);
            }
        } catch (err) {
            console.error('Error saving form config:', err);
            alert('Failed to save form configuration.');
        }
    };

    if (loading) return <div className="p-8 text-center text-[#5e718d] font-bold">Loading system settings...</div>;

    return (
        <div className="max-w-[1240px] mx-auto px-6 py-12">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-[#101418] tracking-tight">Admin Console</h1>
                    <p className="text-[#5e718d] mt-2 font-medium">Configure service desks, categories, and dynamic forms.</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-2xl shadow-gray-100/50">
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
                        className="flex items-center gap-2 px-8 py-3.5 bg-[#0052cc] text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200/50 uppercase tracking-widest text-xs"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        Add Category
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr className="text-[11px] font-black text-[#5e718d] uppercase tracking-[0.2em]">
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
                                <tr key={cat.id} className={`hover:bg-gray-50/50 transition-colors ${selectedCategory?.id === cat.id ? 'bg-blue-50/30' : ''}`}>
                                    <td className="px-8 py-6 font-bold text-gray-400">{cat.displayOrder}</td>
                                    <td className="px-8 py-6">
                                        <div className={`w-12 h-12 ${cat.colorClass} rounded-xl flex items-center justify-center shadow-sm`}>
                                            <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-[#101418] text-lg">{cat.name}</div>
                                        <div className="text-sm text-[#5e718d] max-w-xs truncate mt-1">{cat.description || 'No description'}</div>
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
                                                className="w-10 h-10 flex items-center justify-center text-[#5e718d] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                            >
                                                <span className="material-symbols-outlined text-xl">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="w-10 h-10 flex items-center justify-center text-[#5e718d] hover:bg-white hover:text-red-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                            >
                                                <span className="material-symbols-outlined text-xl">delete</span>
                                            </button>
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
                                <p className="text-[#5e718d] font-medium">Configure individual request forms and their custom fields.</p>
                            </div>
                            <button className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-[#101418] font-bold rounded-2xl hover:bg-gray-100 transition-all text-xs uppercase tracking-widest shadow-sm">
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
                                                <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <h4 className="font-black text-[#101418] text-lg mb-2">{type.name}</h4>
                                        <p className="text-sm text-[#5e718d] mb-6 line-clamp-2 min-h-[40px] leading-relaxed">{type.description || 'No description provided for this service.'}</p>

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
                                    <p className="text-[#5e718d] font-bold">No services found for this category.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
                                    className="flex-1 px-8 py-5 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200/50 uppercase tracking-widest text-xs"
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
        </div>
    );
};

export default AdminSettings;
