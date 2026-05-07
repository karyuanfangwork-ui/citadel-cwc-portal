import React, { useState, useCallback, useRef } from 'react';
import { adminService } from '../../services/admin.service';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ImportStaffModalProps {
    onSuccess: () => void;
    onClose: () => void;
}

type ImportPhase = 'upload' | 'uploading' | 'results';

interface ImportResult {
    summary: {
        total: number;
        created: number;
        updated: number;
        skipped: number;
        errors: number;
    };
    details: {
        email: string;
        displayName: string;
        action: 'created' | 'updated' | 'skipped' | 'error';
        message: string;
    }[];
}

const actionColors: Record<string, string> = {
    created: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    updated: 'bg-blue-50 text-blue-700 border-blue-100',
    skipped: 'bg-gray-50 text-gray-600 border-gray-100',
    error: 'bg-red-50 text-red-700 border-red-100',
};

const actionIcons: Record<string, string> = {
    created: 'check_circle',
    updated: 'edit',
    skipped: 'skip_next',
    error: 'error',
};

const ImportStaffModal: React.FC<ImportStaffModalProps> = ({ onSuccess, onClose }) => {
    const focusTrapRef = useFocusTrap(true);
    const stableOnClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(stableOnClose);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [phase, setPhase] = useState<ImportPhase>('upload');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultFilter, setResultFilter] = useState<string>('all');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
                setError('Please upload an .xlsx or .xls file.');
                return;
            }
            setSelectedFile(file);
            setError(null);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select a file to upload.');
            return;
        }

        setPhase('uploading');
        setError(null);

        try {
            const data = await adminService.importStaff(selectedFile);
            setResult(data);
            setPhase('results');
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Import failed. Please check the file and try again.';
            setError(msg);
            setPhase('upload');
        }
    };

    const filteredDetails = result?.details.filter(d =>
        resultFilter === 'all' || d.action === resultFilter
    ) || [];

    const handleDone = () => {
        onSuccess();
        onClose();
    };

    const handleReset = () => {
        setSelectedFile(null);
        setResult(null);
        setError(null);
        setPhase('upload');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Import Staff">
            <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] overflow-hidden" style={{ maxWidth: phase === 'results' ? '800px' : '500px' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#0052cc]">upload_file</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Import Staff</h2>
                            <p className="text-xs text-gray-500">
                                {phase === 'results' ? 'Import complete' : 'Upload Excel file with staff data'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {phase === 'upload' && (
                        <div className="p-5 space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                                    selectedFile ? 'border-[#0052cc] bg-blue-50/30' : 'border-gray-200 hover:border-[#0052cc] hover:bg-gray-50'
                                }`}
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                            >
                                <span className="material-symbols-outlined text-4xl text-gray-400 block mx-auto mb-3">
                                    {selectedFile ? 'description' : 'cloud_upload'}
                                </span>
                                {selectedFile ? (
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{selectedFile.name}</p>
                                        <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">Drop your Excel file here or click to browse</p>
                                        <p className="text-xs text-gray-500 mt-1">Supports .xlsx and .xls files</p>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
                                <p className="font-bold text-gray-700 mb-1">Expected Excel columns:</p>
                                <p><span className="font-semibold text-gray-600">Display Name</span> — Full name (with prefixes like Dato', Dr., etc.)</p>
                                <p><span className="font-semibold text-gray-600">Email</span> — Work email address</p>
                                <p><span className="font-semibold text-gray-600">Job Title</span> — Job title / position</p>
                                <p><span className="font-semibold text-gray-600">Company / Entity</span> — Entity name (e.g. Citadel Group Sdn. Bhd.)</p>
                                <p className="text-gray-400 mt-2">New users get NORMAL_STAFF role and a default password.</p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                                    <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">error</span>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!selectedFile}
                                    className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-xl hover:bg-[#0047b3] disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Import
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'uploading' && (
                        <div className="p-12 text-center">
                            <div className="w-12 h-12 border-4 border-[#0052cc] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm font-bold text-gray-900">Processing import…</p>
                            <p className="text-xs text-gray-500 mt-1">This may take a moment for large files.</p>
                        </div>
                    )}

                    {phase === 'results' && result && (
                        <div className="p-5 space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-5 gap-3">
                                {[
                                    { label: 'Total', value: result.summary.total, icon: 'group', color: 'bg-gray-50 text-gray-600' },
                                    { label: 'Created', value: result.summary.created, icon: 'check_circle', color: 'bg-emerald-50 text-emerald-600' },
                                    { label: 'Updated', value: result.summary.updated, icon: 'edit', color: 'bg-blue-50 text-blue-600' },
                                    { label: 'Skipped', value: result.summary.skipped, icon: 'skip_next', color: 'bg-gray-50 text-gray-500' },
                                    { label: 'Errors', value: result.summary.errors, icon: 'error', color: result.summary.errors > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400' },
                                ].map(card => (
                                    <div key={card.label} className="flex flex-col items-center p-3 rounded-xl border border-gray-100 bg-white">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                                            <span className="material-symbols-outlined text-lg">{card.icon}</span>
                                        </div>
                                        <p className="text-xl font-black text-gray-900 mt-1">{card.value}</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{card.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filter:</span>
                                {['all', 'created', 'updated', 'skipped', 'error'].map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setResultFilter(filter)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${
                                            resultFilter === filter
                                                ? 'bg-[#0052cc] text-white border-[#0052cc]'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {/* Detail Table */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10">
                                        <tr className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Email</th>
                                            <th className="px-4 py-3">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredDetails.map((d, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase rounded-full border ${actionColors[d.action]}`}>
                                                        {d.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{d.displayName}</td>
                                                <td className="px-4 py-2.5 text-sm text-gray-600">{d.email}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{d.message}</td>
                                            </tr>
                                        ))}
                                        {filteredDetails.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                                                    No rows match this filter.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={handleReset} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
                                    Import Another
                                </button>
                                <button onClick={handleDone} className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-xl hover:bg-[#0047b3]">
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportStaffModal;