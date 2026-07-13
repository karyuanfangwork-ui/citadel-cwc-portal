import React, { useState, useEffect, useCallback } from 'react';
import systemSettingService from '../../services/systemSetting.service';

export const ESMSettingsTab: React.FC = () => {
    const [threshold, setThreshold] = useState<number>(50000);
    const [savedThreshold, setSavedThreshold] = useState<number>(50000);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchThreshold = useCallback(async () => {
        try {
            setLoading(true);
            const value = await systemSettingService.getEsmDceoThreshold();
            setThreshold(value);
            setSavedThreshold(value);
        } catch {
            setMessage({ type: 'error', text: 'Failed to load threshold setting.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThreshold();
    }, [fetchThreshold]);

    const handleSave = async () => {
        if (threshold < 0) {
            setMessage({ type: 'error', text: 'Threshold must be a non-negative number.' });
            return;
        }
        try {
            setSaving(true);
            setMessage(null);
            const saved = await systemSettingService.setEsmDceoThreshold(threshold);
            setSavedThreshold(saved);
            setMessage({ type: 'success', text: 'Threshold saved successfully.' });
        } catch {
            setMessage({ type: 'error', text: 'Failed to save threshold. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = threshold !== savedThreshold;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0052cc]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-[#101418] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0052cc]">flight_takeoff</span>
                    ESM Travel Request Settings
                </h3>
                <p className="text-sm text-[#44546f] mt-1">
                    Configure approval thresholds and routing rules for CWC Travel Requests.
                </p>
            </div>

            {/* Threshold Card */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-[#101418] flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-lg">monitoring</span>
                            GROUP Deputy CEO Approval Threshold
                        </h4>
                        <p className="text-xs text-[#44546f] mt-1 max-w-xl">
                            When a CWC Travel Request's total amount exceeds this threshold, the system will
                            automatically route it to the GROUP Deputy CEO for additional approval after the CEO approves.
                            Requests at or below this threshold will skip the GROUP DCEO step and go directly to the
                            requester for booking confirmation.
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex items-end gap-4">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-xs font-medium text-[#44546f] mb-1">
                            Threshold Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                                RM
                            </span>
                            <input
                                type="number"
                                min={0}
                                step={1000}
                                value={threshold}
                                onChange={(e) => setThreshold(Number(e.target.value))}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc] focus:border-[#0052cc] transition-all"
                                placeholder="50000"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            hasChanges && !saving
                                ? 'bg-[#0052cc] text-white hover:bg-[#003d99]'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Saving…
                            </span>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>

                {/* Info about current routing */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-sm mt-0.5">info</span>
                        <div className="text-xs text-blue-800">
                            <p className="font-medium">Current routing behaviour:</p>
                            <ul className="mt-1 space-y-0.5 list-disc list-inside">
                                <li>Amount ≤ RM {savedThreshold.toLocaleString()}: CEO approval → Requester confirms booking</li>
                                <li>Amount &gt; RM {savedThreshold.toLocaleString()}: CEO approval → GROUP DCEO approval → Requester confirms booking</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status message */}
            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                    <span className="material-symbols-outlined text-sm">
                        {message.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {message.text}
                </div>
            )}
        </div>
    );
};