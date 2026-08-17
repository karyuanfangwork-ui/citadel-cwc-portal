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

// P5-05: Conditional-field rule types
interface Condition {
    fieldId: string;
    operator: 'eq' | 'neq' | 'contains' | 'startsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'notEmpty' | 'in';
    value?: string | number | boolean | string[];
}

interface ConditionalRule {
    operator?: 'and' | 'or';
    conditions: Condition[];
}

interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'currency' | 'file' | 'entity' | 'ceo-select';
    required: boolean;
    options?: string[];
    showWhen?: ConditionalRule;
}

interface FormBuilderProps {
    initialFields: FormField[];
    onSave: (fields: FormField[]) => void;
    onCancel: () => void;
    title: string;
}

interface SortableFieldProps {
    field: FormField;
    fields: FormField[];
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<FormField>) => void;
    onDuplicate: (id: string) => void;
}

const SortableField: React.FC<SortableFieldProps> = ({ field, fields, onRemove, onUpdate, onDuplicate }) => {
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
                        <option value="ceo-select">CEO Approver (CEO / Group DCEO)</option>
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

                {/* P5-05: Conditional visibility (showWhen) editor */}
                <div className="sm:col-span-12 mt-2 pt-3 border-t border-gray-200/50">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-sm text-[#44546f]">visibility_lock</span>
                        <span className="text-[10px] font-bold text-[#44546f] uppercase tracking-wider">Show When (Conditional)</span>
                        {field.showWhen && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">
                                {field.showWhen.conditions.length} rule{field.showWhen.conditions.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {field.showWhen ? (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Match</span>
                                <select
                                    className="px-2 py-1 bg-white border border-gray-200 rounded text-xs focus:border-[#0052cc] outline-none"
                                    value={field.showWhen.operator || 'and'}
                                    onChange={e => onUpdate(field.id, { showWhen: { ...field.showWhen!, operator: e.target.value as 'and' | 'or' } })}
                                >
                                    <option value="and">ALL (and)</option>
                                    <option value="or">ANY (or)</option>
                                </select>
                                <span className="text-[10px] text-gray-500">of the following:</span>
                            </div>
                            {field.showWhen.conditions.map((cond, ci) => (
                                <div key={ci} className="flex items-center gap-1.5 pl-2">
                                    <select
                                        className="px-1.5 py-1 bg-white border border-gray-200 rounded text-[11px] focus:border-[#0052cc] outline-none min-w-0 flex-shrink"
                                        value={cond.fieldId}
                                        onChange={e => {
                                            const newConditions = [...field.showWhen!.conditions];
                                            newConditions[ci] = { ...newConditions[ci], fieldId: e.target.value };
                                            onUpdate(field.id, { showWhen: { ...field.showWhen!, conditions: newConditions } });
                                        }}
                                    >
                                        <option value="">Select field…</option>
                                        {/* Exclude self-references */}
                                        {fields.filter(f => f.id !== field.id).map(f => (
                                            <option key={f.id} value={f.id}>{f.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="px-1.5 py-1 bg-white border border-gray-200 rounded text-[11px] focus:border-[#0052cc] outline-none"
                                        value={cond.operator}
                                        onChange={e => {
                                            const newConditions = [...field.showWhen!.conditions];
                                            newConditions[ci] = { ...newConditions[ci], operator: e.target.value as Condition['operator'] };
                                            onUpdate(field.id, { showWhen: { ...field.showWhen!, conditions: newConditions } });
                                        }}
                                    >
                                        <option value="eq">equals</option>
                                        <option value="neq">not equals</option>
                                        <option value="contains">contains</option>
                                        <option value="startsWith">starts with</option>
                                        <option value="gt">greater than</option>
                                        <option value="gte">≥</option>
                                        <option value="lt">less than</option>
                                        <option value="lte">≤</option>
                                        <option value="empty">is empty</option>
                                        <option value="notEmpty">not empty</option>
                                        <option value="in">in list</option>
                                    </select>
                                    {!['empty', 'notEmpty'].includes(cond.operator) && (
                                        <input
                                            type="text"
                                            placeholder="Value"
                                            className="px-2 py-1 bg-white border border-gray-200 rounded text-[11px] focus:border-[#0052cc] outline-none min-w-0 flex-grow"
                                            value={typeof cond.value === 'string' ? cond.value : typeof cond.value === 'number' ? String(cond.value) : Array.isArray(cond.value) ? cond.value.join(',') : ''}
                                            onChange={e => {
                                                const newConditions = [...field.showWhen!.conditions];
                                                newConditions[ci] = { ...newConditions[ci], value: e.target.value };
                                                onUpdate(field.id, { showWhen: { ...field.showWhen!, conditions: newConditions } });
                                            }}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newConditions = field.showWhen!.conditions.filter((_, i) => i !== ci);
                                            if (newConditions.length === 0) {
                                                onUpdate(field.id, { showWhen: undefined });
                                            } else {
                                                onUpdate(field.id, { showWhen: { ...field.showWhen!, conditions: newConditions } });
                                            }
                                        }}
                                        className="material-symbols-outlined text-sm text-gray-400 hover:text-red-500"
                                    >
                                        close
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => onUpdate(field.id, { showWhen: { ...field.showWhen!, conditions: [...field.showWhen!.conditions, { fieldId: '', operator: 'eq' as const, value: '' }] } })}
                                className="text-[10px] font-bold text-[#0052cc] hover:underline mt-1"
                            >
                                + Add condition
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdate(field.id, { showWhen: undefined })}
                                className="text-[10px] font-bold text-red-500 hover:underline ml-3"
                            >
                                Remove all rules
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onUpdate(field.id, { showWhen: { operator: 'and', conditions: [{ fieldId: '', operator: 'eq', value: '' }] } })}
                            className="text-[10px] font-bold text-[#0052cc] hover:underline"
                        >
                            + Add visibility rule
                        </button>
                    )}
                </div>
            </div>

            <button
                onClick={() => onDuplicate(field.id)}
                className="mt-6 p-1.5 text-gray-300 hover:text-[#0052cc] hover:bg-blue-50 rounded-lg transition-all flex-shrink-0"
                title="Duplicate field"
            >
                <span className="material-symbols-outlined text-lg">content_copy</span>
            </button>
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
    const [previewMode, setPreviewMode] = useState(false);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const addField = () => {
        setFields(prev => [...prev, { id: `field_${Date.now()}`, label: 'New Field', type: 'text', required: false }]);
    };

    const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id));

    const duplicateField = (id: string) => {
        setFields(prev => {
            const index = prev.findIndex(f => f.id === id);
            if (index === -1) return prev;
            const original = prev[index];
            const clone: FormField = {
                ...JSON.parse(JSON.stringify(original)),
                id: `field_${Date.now()}`,
                label: `${original.label} (copy)`,
            };
            const updated = [...prev];
            updated.splice(index + 1, 0, clone);
            return updated;
        });
    };

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
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setPreviewMode(!previewMode)}
                        className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg transition-all text-xs ${previewMode ? 'bg-[#0052cc] text-white shadow-sm' : 'bg-[#0052cc]/10 text-[#0052cc] hover:bg-[#0052cc]/20'}`}
                    >
                        <span className="material-symbols-outlined text-sm">{previewMode ? 'edit' : 'preview'}</span>
                        {previewMode ? 'Edit' : 'Preview'}
                    </button>
                    {!previewMode && (
                        <button
                            onClick={addField}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0052cc]/10 text-[#0052cc] font-bold rounded-lg hover:bg-[#0052cc]/20 transition-all text-xs"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Add Field
                        </button>
                    )}
                </div>
            </div>

            {previewMode ? (
                <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {fields.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-[#44546f] text-sm italic">No custom fields defined. Basic fields (Summary, Description) are always included.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {fields.map(field => (
                                <div key={field.id} className="space-y-1.5">
                                    <label className="block text-sm font-bold text-[#101418]">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                        {field.showWhen && (
                                            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded" title={JSON.stringify(field.showWhen)}>
                                                conditional
                                            </span>
                                        )}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 min-h-[80px]">
                                            {field.label} will appear here...
                                        </div>
                                    ) : field.type === 'select' || field.type === 'entity' || field.type === 'ceo-select' ? (
                                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-between">
                                            <span>{field.type === 'entity' ? 'Select entity...' : field.type === 'ceo-select' ? 'Select a CEO approver...' : (field.options?.length ? 'Select an option...' : 'No options added')}</span>
                                            <span className="material-symbols-outlined text-base text-gray-300">expand_more</span>
                                        </div>
                                    ) : field.type === 'date' ? (
                                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-between">
                                            <span>dd/mm/yyyy</span>
                                            <span className="material-symbols-outlined text-base text-gray-300">calendar_today</span>
                                        </div>
                                    ) : field.type === 'file' ? (
                                        <div className="w-full py-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-center text-sm text-gray-400">
                                            <span className="material-symbols-outlined text-3xl text-gray-300 block mx-auto mb-2">cloud_upload</span>
                                            Click to upload or drag and drop
                                        </div>
                                    ) : field.type === 'currency' ? (
                                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center">
                                            <span className="text-gray-300 font-bold mr-2">RM</span>
                                            <span>0.00</span>
                                        </div>
                                    ) : field.type === 'number' ? (
                                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400">
                                            0
                                        </div>
                                    ) : (
                                        <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400">
                                            {field.label} will appear here...
                                        </div>
                                    )}
                                    {(field.type === 'select' && field.options && field.options.length > 0) && (
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {field.options.map((opt, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-[#0052cc]/5 text-[#0052cc] text-[10px] font-bold rounded-md border border-[#0052cc]/10">
                                                    {opt}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
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
                                           fields={fields}
                                           onRemove={removeField}
                                           onUpdate={updateField}
                                           onDuplicate={duplicateField}
                                       />
                                   ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            )}

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
