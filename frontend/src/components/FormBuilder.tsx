import React, { useState } from 'react';

interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'file';
    required: boolean;
    options?: string[]; // For 'select' type
}

interface FormBuilderProps {
    initialFields: FormField[];
    onSave: (fields: FormField[]) => void;
    onCancel: () => void;
    title: string;
}

const FormBuilder: React.FC<FormBuilderProps> = ({ initialFields, onSave, onCancel, title }) => {
    const [fields, setFields] = useState<FormField[]>(initialFields || []);

    const addField = () => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            label: 'New Field',
            type: 'text',
            required: false,
        };
        setFields([...fields, newField]);
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleSave = () => {
        onSave(fields);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#101418]">{title}</h3>
                <button
                    onClick={addField}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0052cc]/10 text-[#0052cc] font-bold rounded-lg hover:bg-[#0052cc]/20 transition-all text-xs"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Field
                </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {fields.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-[#5e718d] text-sm italic">No custom fields defined. Basic fields (Summary, Description) are always included.</p>
                    </div>
                ) : (
                    fields.map((field, index) => (
                        <div key={field.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex gap-4 items-start group">
                            <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-5">
                                    <label className="block text-[10px] font-bold text-[#44546f] uppercase tracking-wider mb-1">Field Label</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#0052cc] outline-none"
                                        value={field.label}
                                        onChange={e => updateField(field.id, { label: e.target.value })}
                                    />
                                </div>

                                <div className="sm:col-span-3">
                                    <label className="block text-[10px] font-bold text-[#44546f] uppercase tracking-wider mb-1">Type</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#0052cc] outline-none appearance-none"
                                        value={field.type}
                                        onChange={e => updateField(field.id, { type: e.target.value as any })}
                                    >
                                        <option value="text">Text</option>
                                        <option value="textarea">Textarea</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="file">File Upload</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-3 flex items-center h-full pt-5">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-[#0052cc] focus:ring-[#0052cc]"
                                            checked={field.required}
                                            onChange={e => updateField(field.id, { required: e.target.checked })}
                                        />
                                        <span className="text-xs font-bold text-[#44546f]">Required</span>
                                    </label>
                                </div>
                            </div>

                            <button
                                onClick={() => removeField(field.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Remove field"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                    onClick={onCancel}
                    className="flex-1 px-6 py-3 bg-gray-100 text-[#44546f] font-bold rounded-xl hover:bg-gray-200 transition-all text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="flex-1 px-6 py-3 bg-[#0052cc] text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-100"
                >
                    Save Configuration
                </button>
            </div>
        </div>
    );
};

export default FormBuilder;
