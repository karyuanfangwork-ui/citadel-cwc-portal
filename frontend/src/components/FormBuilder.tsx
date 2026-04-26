import React, { useState } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'currency' | 'file' | 'entity';
    required: boolean;
    options?: string[];
}

interface FormBuilderProps {
    initialFields: FormField[];
    onSave: (fields: FormField[]) => void;
    onCancel: () => void;
    title: string;
}

interface SortableFieldProps {
    field: FormField;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<FormField>) => void;
}

const SortableField: React.FC<SortableFieldProps> = ({ field, onRemove, onUpdate }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex gap-2 items-start group"
        >
            {/* Drag handle */}
            <button
                {...attributes}
                {...listeners}
                className="mt-6 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing rounded transition-colors flex-shrink-0"
                title="Drag to reorder"
                tabIndex={-1}
            >
                <span className="material-symbols-outlined text-lg select-none">drag_indicator</span>
            </button>

            <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold text-[#44546f] uppercase tracking-wider mb-1">Field Label</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#0052cc] outline-none"
                        value={field.label}
                        onChange={e => onUpdate(field.id, { label: e.target.value })}
                    />
                </div>

                <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-[#44546f] uppercase tracking-wider mb-1">Type</label>
                    <select
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#0052cc] outline-none appearance-none"
                        value={field.type}
                        onChange={e => {
                            const newType = e.target.value as FormField['type'];
                            const updates: Partial<FormField> = { type: newType };
                            if (newType === 'select' && !field.options) updates.options = [];
                            onUpdate(field.id, updates);
                        }}
                    >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="number">Number</option>
                        <option value="currency">Currency (RM)</option>
                        <option value="date">Date</option>
                        <option value="select">Dropdown (Select)</option>
                        <option value="file">File Upload</option>
                        <option value="entity">Entity (Dropdown)</option>
                    </select>
                </div>

                <div className="sm:col-span-3 flex items-center h-full pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-[#0052cc] focus:ring-[#0052cc]"
                            checked={field.required}
                            onChange={e => onUpdate(field.id, { required: e.target.checked })}
                        />
                        <span className="text-xs font-bold text-[#44546f]">Required</span>
                    </label>
                </div>

                {field.type === 'select' && (
                    <div className="sm:col-span-12 mt-2 pt-3 border-t border-gray-200/50">
                        <label className="block text-[10px] font-bold text-[#44546f] uppercase tracking-wider mb-2">Dropdown Options</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {field.options?.map((opt, optIdx) => (
                                <span key={optIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-[#0052cc]/5 text-[#0052cc] text-[11px] font-bold rounded-lg border border-[#0052cc]/10">
                                    {opt}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newOpts = [...(field.options || [])];
                                            newOpts.splice(optIdx, 1);
                                            onUpdate(field.id, { options: newOpts });
                                        }}
                                        className="material-symbols-outlined text-[14px] hover:text-red-500 transition-colors ml-1"
                                    >
                                        close
                                    </button>
                                </span>
                            ))}
                            {(field.options?.length || 0) === 0 && (
                                <p className="text-[10px] italic text-gray-400">Add options below...</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Add option (e.g. IT Hardware)"
                                className="flex-grow px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:border-[#0052cc] outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val && !field.options?.includes(val)) {
                                            onUpdate(field.id, { options: [...(field.options || []), val] });
                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    const val = input.value.trim();
                                    if (val && !field.options?.includes(val)) {
                                        onUpdate(field.id, { options: [...(field.options || []), val] });
                                        input.value = '';
                                    }
                                }}
                                className="px-4 py-2 bg-[#0052cc] text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                )}

                {field.type === 'entity' && (
                    <div className="sm:col-span-12 mt-2 pt-3 border-t border-gray-200/50">
                        <p className="text-xs text-[#44546f] italic">
                            Options are auto-populated from the Entity master list. No manual options needed.
                            The stored value will be the entity code (e.g. CIT-MY).
                        </p>
                    </div>
                )}
            </div>

            <button
                onClick={() => onRemove(field.id)}
                className="mt-6 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                title="Remove field"
            >
                <span className="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
    );
};

const FormBuilder: React.FC<FormBuilderProps> = ({ initialFields, onSave, onCancel, title }) => {
    const [fields, setFields] = useState<FormField[]>(initialFields || []);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const addField = () => {
        setFields(prev => [...prev, { id: `field_${Date.now()}`, label: 'New Field', type: 'text', required: false }]);
    };

    const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id));

    const updateField = (id: string, updates: Partial<FormField>) =>
        setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setFields(prev => {
                const oldIndex = prev.findIndex(f => f.id === active.id);
                const newIndex = prev.findIndex(f => f.id === over.id);
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
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
                        <p className="text-[#44546f] text-sm italic">No custom fields defined. Basic fields (Summary, Description) are always included.</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-4">
                                {fields.map(field => (
                                    <SortableField
                                        key={field.id}
                                        field={field}
                                        onRemove={removeField}
                                        onUpdate={updateField}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
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
                    onClick={() => onSave(fields)}
                    className="flex-1 px-6 py-3 bg-[#0052cc] text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm shadow-sm"
                >
                    Save Configuration
                </button>
            </div>
        </div>
    );
};

export default FormBuilder;
