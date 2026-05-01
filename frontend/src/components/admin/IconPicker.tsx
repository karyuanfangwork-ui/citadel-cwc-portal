import React, { useState } from 'react';
import { CATEGORY_ICONS } from './adminConstants';

interface IconPickerProps {
    value: string;
    onChange: (iconName: string) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange }) => {
    const [query, setQuery] = useState('');

    const filtered = CATEGORY_ICONS.filter(icon => {
        const q = query.toLowerCase();
        return icon.name.toLowerCase().includes(q) || icon.label.toLowerCase().includes(q);
    });

    return (
        <div className="space-y-3">
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-lg">search</span>
                <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                    placeholder="Search icons..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {filtered.map(icon => (
                        <button
                            key={icon.name}
                            type="button"
                            onClick={() => onChange(icon.name)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all ${
                                icon.name === value
                                    ? 'bg-blue-50 ring-2 ring-[#0052cc] border border-[#0052cc]'
                                    : 'bg-white border border-gray-100 hover:border-[#0052cc]/40 hover:shadow-sm hover:bg-gray-50'
                            }`}
                            title={icon.label}
                        >
                            <span className={`material-symbols-outlined text-xl ${icon.name === value ? 'text-[#0052cc]' : 'text-gray-500'}`}>
                                {icon.name}
                            </span>
                            <span className={`text-[9px] font-bold leading-tight text-center line-clamp-1 ${icon.name === value ? 'text-[#0052cc]' : 'text-gray-400'}`}>
                                {icon.label}
                            </span>
                        </button>
                    ))}
                </div>
                {filtered.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-4">No icons match your search.</p>
                )}
            </div>
        </div>
    );
};