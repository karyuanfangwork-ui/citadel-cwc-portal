import React from 'react';
import { CategoryData } from '../../services/admin.service';
import { CATEGORY_ICONS, COLOR_THEMES } from './adminConstants';

interface CategoryModalProps {
    isOpen: boolean;
    editingCategory: any;
    formData: CategoryData;
    onSave: (e: React.FormEvent) => void;
    onClose: () => void;
    onFormDataChange: (data: CategoryData) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
    isOpen,
    editingCategory,
    formData,
    onSave,
    onClose,
    onFormDataChange,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden scale-in flex flex-col max-h-[90vh]">
                <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-3xl font-black text-[#101418]">
                        {editingCategory ? 'Edit Category' : 'New Category'}
                    </h2>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>
                </div>

                <form onSubmit={onSave} className="p-10 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Category Display Name *</label>
                            <input
                                required
                                type="text"
                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                placeholder="e.g. Hardware Support"
                                value={formData.name}
                                onChange={e => onFormDataChange({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Description</label>
                            <textarea
                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all resize-none leading-relaxed"
                                placeholder="Explain what kind of requests fall under this category..."
                                rows={4}
                                value={formData.description}
                                onChange={e => onFormDataChange({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest">Visual Icon *</label>
                            <div className="relative">
                                <select
                                    className="w-full pl-6 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none cursor-pointer appearance-none transition-all"
                                    value={formData.icon}
                                    onChange={e => onFormDataChange({ ...formData, icon: e.target.value })}
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
                                onChange={e => onFormDataChange({ ...formData, displayOrder: parseInt(e.target.value) })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-4">Brand Accent Color *</label>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
                                {COLOR_THEMES.map(theme => (
                                    <button
                                        key={theme.name}
                                        type="button"
                                        onClick={() => onFormDataChange({ ...formData, colorClass: theme.class })}
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
                                        onChange={e => onFormDataChange({ ...formData, isActive: e.target.checked })}
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
                            onClick={onClose}
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
    );
};
