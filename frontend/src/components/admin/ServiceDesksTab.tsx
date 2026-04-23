import React from 'react';
import { CategoryData } from '../../services/admin.service';

interface ServiceDesksTabProps {
    serviceDesks: any[];
    selectedDesk: any;
    categories: any[];
    selectedCategory: any;
    requestTypes: any[];
    availableRoles: any[];
    formData: CategoryData;
    modalOpen: boolean;
    serviceModalOpen: boolean;
    onDeskChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onAddCategory: () => void;
    onEditCategory: (cat: any) => void;
    onDeleteCategory: (catId: string) => void;
    onReactivateCategory: (catId: string) => void;
    onMoveCategory: (cat: any, direction: 'up' | 'down') => void;
    onManageTypes: (cat: any) => void;
    onOpenServiceModal: () => void;
    onDeleteService: (typeId: string) => void;
    onEditTypeName: (type: any) => void;
    onOpenFormBuilder: (type: any) => void;
}

export const ServiceDesksTab: React.FC<ServiceDesksTabProps> = ({
    serviceDesks,
    selectedDesk,
    categories,
    selectedCategory,
    requestTypes,
    availableRoles,
    formData,
    modalOpen,
    serviceModalOpen,
    onDeskChange,
    onAddCategory,
    onEditCategory,
    onDeleteCategory,
    onReactivateCategory,
    onMoveCategory,
    onManageTypes,
    onOpenServiceModal,
    onDeleteService,
    onEditTypeName,
    onOpenFormBuilder,
}) => {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50/20">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-[#44546f] uppercase tracking-wider">Service Desk</label>
                    <div className="relative">
                        <select
                            className="pl-6 pr-12 py-3 bg-white border border-gray-200 rounded-2xl text-base font-bold text-[#101418] focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none cursor-pointer appearance-none transition-all"
                            value={selectedDesk?.id || ''}
                            onChange={onDeskChange}
                        >
                            {serviceDesks.map(desk => (
                                <option key={desk.id} value={desk.id}>{desk.name}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                    </div>
                </div>
                <button
                    onClick={onAddCategory}
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
                                            onClick={() => onMoveCategory(cat, 'up')}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-300 hover:text-[#0052cc] transition-all"
                                            title="Move up"
                                        >
                                            <span className="material-symbols-outlined text-base">arrow_upward</span>
                                        </button>
                                        <span className="font-bold text-gray-400 text-sm">{cat.displayOrder}</span>
                                        <button
                                            onClick={() => onMoveCategory(cat, 'down')}
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
                                        onClick={() => onManageTypes(cat)}
                                        className={`group flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${selectedCategory?.id === cat.id ? 'bg-[#0052cc] text-white border-[#0052cc] shadow-lg shadow-blue-100' : 'bg-white text-[#44546f] border-gray-200 hover:border-[#0052cc] hover:text-[#0052cc]'}`}
                                    >
                                        <span className="material-symbols-outlined text-xl">settings_input_component</span>
                                        <span className="text-xs font-black uppercase tracking-widest">Manage</span>
                                    </button>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => onEditCategory(cat)}
                                            className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-[#0052cc] hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                            title="Edit category"
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        {cat.isActive ? (
                                            <button
                                                onClick={() => onDeleteCategory(cat.id)}
                                                className="w-10 h-10 flex items-center justify-center text-[#44546f] hover:bg-white hover:text-red-600 hover:shadow-md rounded-xl transition-all border border-transparent hover:border-gray-100"
                                                title="Deactivate category"
                                            >
                                                <span className="material-symbols-outlined text-xl">delete</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onReactivateCategory(cat.id)}
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
                            onClick={onOpenServiceModal}
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
                                                onClick={() => onEditTypeName(type)}
                                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                title="Edit Name & Description"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                            <button
                                                onClick={() => onOpenFormBuilder(type)}
                                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-[#0052cc] hover:bg-blue-50 rounded-xl transition-all"
                                                title="Configure Form Fields"
                                            >
                                                <span className="material-symbols-outlined text-[22px]">dynamic_form</span>
                                            </button>
                                            <button
                                                onClick={() => onDeleteService(type.id)}
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
    );
};
