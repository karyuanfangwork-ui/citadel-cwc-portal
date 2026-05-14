import React, { useEffect, useRef, useState } from 'react';
import { requestService, RequestParticipant } from '../../services/request.service';
import apiClient from '../../services/api';

interface UserSearchResult {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
}

interface ParticipantsSectionProps {
    requestId: string;
    canEdit: boolean; // true for requester, agent, admin
}

export default function ParticipantsSection({ requestId, canEdit }: ParticipantsSectionProps) {
    const [participants, setParticipants] = useState<RequestParticipant[]>([]);
    const [showSearch, setShowSearch] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        requestService.getParticipants(requestId).then(setParticipants).catch(() => {});
    }, [requestId]);

    // Close dropdown on outside click (ignore clicks on the "+ Add" button itself)
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            // Ignore clicks on the "+ Add" button — it toggles showSearch on its own
            if (addBtnRef.current && addBtnRef.current.contains(target)) return;
            if (searchRef.current && !searchRef.current.contains(target)) {
                setShowSearch(false);
                setQuery('');
                setResults([]);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!val.trim()) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/users?search=${encodeURIComponent(val)}&limit=8`);
                const users: UserSearchResult[] = res.data.data?.users ?? res.data.data ?? [];
                // Filter out already-added participants
                const participantIds = new Set(participants.map((p) => p.userId));
                setResults(users.filter((u) => !participantIds.has(u.id)));
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    }

    async function handleAdd(user: UserSearchResult) {
        setAddingId(user.id);
        try {
            const participant = await requestService.addParticipant(requestId, user.id);
            setParticipants((prev) => [...prev, participant]);
            setQuery('');
            setResults([]);
            setShowSearch(false);
        } catch {
            // silently ignore — could show a toast here
        } finally {
            setAddingId(null);
        }
    }

    async function handleRemove(userId: string) {
        setRemovingId(userId);
        try {
            await requestService.removeParticipant(requestId, userId);
            setParticipants((prev) => prev.filter((p) => p.userId !== userId));
        } catch {
            // silently ignore
        } finally {
            setRemovingId(null);
        }
    }

    function initials(p: RequestParticipant) {
        return `${p.user.firstName[0] ?? ''}${p.user.lastName[0] ?? ''}`.toUpperCase();
    }

    return (
        <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Participants {participants.length > 0 && `(${participants.length})`}
                </span>
                {canEdit && (
                    <button
                        ref={addBtnRef}
                        onClick={() => setShowSearch((s) => !s)}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        {showSearch ? 'Cancel' : '+ Add'}
                    </button>
                )}
            </div>

            {/* Participant chips */}
            <div className="flex flex-wrap gap-2 mb-2">
                {participants.map((p) => (
                    <div
                        key={p.userId}
                        title={`${p.user.firstName} ${p.user.lastName} (${p.user.email})`}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
                    >
                        {p.user.avatarUrl ? (
                            <img src={p.user.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                            <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold">
                                {initials(p)}
                            </span>
                        )}
                        <span>{p.user.firstName} {p.user.lastName}</span>
                        {canEdit && (
                            <button
                                onClick={() => handleRemove(p.userId)}
                                disabled={removingId === p.userId}
                                className="ml-1 text-blue-400 hover:text-red-500 leading-none"
                                aria-label={`Remove ${p.user.firstName}`}
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
                {participants.length === 0 && (
                    <span className="text-xs text-gray-400">No participants yet</span>
                )}
            </div>

            {/* Inline typeahead search */}
            {canEdit && showSearch && (
                <div ref={searchRef} className="relative">
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="Search name or email..."
                        className="w-full text-xs border border-blue-400 rounded-md px-2 py-1.5 outline-none"
                    />
                    {(results.length > 0 || loading) && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-md shadow-lg z-20 max-h-48 overflow-y-auto">
                            {loading && (
                                <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
                            )}
                            {results.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => handleAdd(u)}
                                    disabled={addingId === u.id}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 text-xs"
                                >
                                    <span className="w-6 h-6 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                        {`${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase()}
                                    </span>
                                    <span>
                                        <span className="font-medium">{u.firstName} {u.lastName}</span>
                                        <span className="text-gray-400 ml-1">{u.email}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
