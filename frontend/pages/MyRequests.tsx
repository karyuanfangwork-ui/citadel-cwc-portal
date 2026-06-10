import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../src/components/Breadcrumbs';
import { requestService } from '../src/services/request.service';
import { STATUS_CONFIG, RESOLVED_STATUSES_LIST } from '../constants';
import { useAuth } from '../src/context/AuthContext';
import { friendlyMessage } from '../src/utils/errorMessages';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import axios from 'axios';

interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  isConfidential?: boolean;
  slaPaused?: boolean;
  slaDueAt?: string | null;
  serviceDesk?: {
    id: string;
    name: string;
    code: string;
  };
  requestType?: {
    id: string;
    name: string;
  } | null;
  participants?: { userId: string }[];
}

type ViewMode = 'all' | 'created' | 'shared';

const MyRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'open' | 'all'>('open');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string | null>(null);
  const [requestTypeOptions, setRequestTypeOptions] = useState<{ id: string; name: string }[]>([]);
  const limit = 10;

  useEffect(() => {
    const controller = new AbortController();
    fetchRequests(controller.signal);
    return () => controller.abort();
  }, [statusFilter, viewMode, debouncedSearch, page, selectedRequestTypeId]);

  const fetchRequests = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const apiFilters: any = {
        page,
        limit,
      };

      // Apply view mode filter: "created" = only my own, "shared" = participant only, "all" = visibility-based (no filter)
      if (viewMode === 'created') {
        apiFilters.requesterId = user?.id;
      } else if (viewMode === 'shared') {
        apiFilters.participantId = user?.id;
      }
      // viewMode === 'all' → no requesterId/participantId, backend handles visibility

      if (debouncedSearch) {
        apiFilters.search = debouncedSearch;
      }

      if (selectedRequestTypeId) {
        apiFilters.requestTypeId = selectedRequestTypeId;
      }

      // Server-side filtering by status
      if (statusFilter === 'open') {
        apiFilters.excludedStatuses = RESOLVED_STATUSES_LIST.join(',');
      }
      // statusFilter === 'all' → no status filter needed

      const data = await requestService.getAllRequests(apiFilters, signal);

      setRequests(data.requests || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);

      // Build unique request type options from results
      const seen = new Set<string>();
      const options: { id: string; name: string }[] = [];
      (data.requests || []).forEach((r: Request) => {
        if (r.requestType && !seen.has(r.requestType.id)) {
          seen.add(r.requestType.id);
          options.push({ id: r.requestType.id, name: r.requestType.name });
        }
      });
      if (!selectedRequestTypeId) {
        setRequestTypeOptions(options);
      }
    } catch (err: any) {
      // Swallow aborts — they're expected when dependencies change or React StrictMode remounts
      if (axios.isCancel?.(err) || err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled') {
        return;
      }
      console.error('Error fetching requests:', err);
      setError(friendlyMessage(err, 'Unable to load requests. Please refresh.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getServiceIcon = (code: string) => {
    const icons: Record<string, string> = {
      IT: 'laptop',
      HR: 'groups',
      FINANCE: 'account_balance_wallet',
    };
    return icons[code] || 'help';
  };

  const getServiceColor = (code: string) => {
    const colors: Record<string, string> = {
      IT: 'text-[#0052cc]',
      HR: 'text-emerald-600',
      FINANCE: 'text-amber-600',
    };
    return colors[code] || 'text-gray-600';
  };

  const getViewModeLabel = () => {
    if (viewMode === 'created') return 'Created by me';
    if (viewMode === 'shared') return 'Shared with me';
    return 'All requests';
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        { label: 'My Requests' },
      ]} />
      <h1 className="text-[#101418] text-3xl font-extrabold tracking-tight mb-8">My Requests</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setStatusFilter('open');
                setViewMode('all');
                setPage(1);
              }}
              aria-pressed={statusFilter === 'open' && viewMode === 'all'}
              aria-label="Show open requests"
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${statusFilter === 'open' && viewMode === 'all'
                  ? 'bg-[#0052cc]/10 text-[#0052cc] font-bold border-l-4 border-[#0052cc]'
                  : 'text-[#44546f] hover:bg-gray-100'
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">drafts</span>
              Open requests
            </button>
            <button
              onClick={() => {
                setStatusFilter('all');
                setViewMode('all');
                setPage(1);
              }}
              aria-pressed={statusFilter === 'all' && viewMode === 'all'}
              aria-label="Show all requests"
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${statusFilter === 'all' && viewMode === 'all'
                  ? 'bg-[#0052cc]/10 text-[#0052cc] font-bold border-l-4 border-[#0052cc]'
                  : 'text-[#44546f] hover:bg-gray-100'
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
              All requests
            </button>
            <div className="h-px bg-gray-200 my-2"></div>
            <button
              type="button"
              onClick={() => {
                setViewMode('created');
                setStatusFilter('all');
                setPage(1);
              }}
              aria-pressed={viewMode === 'created'}
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${viewMode === 'created'
                  ? 'bg-[#0052cc]/10 text-[#0052cc] font-bold border-l-4 border-[#0052cc]'
                  : 'text-[#44546f] hover:bg-gray-100'
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
              Created by me
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('shared');
                setStatusFilter('all');
                setPage(1);
              }}
              aria-pressed={viewMode === 'shared'}
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${viewMode === 'shared'
                  ? 'bg-[#0052cc]/10 text-[#0052cc] font-bold border-l-4 border-[#0052cc]'
                  : 'text-[#44546f] hover:bg-gray-100'
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
              Shared with me
            </button>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44546f] text-xl">
                search
              </span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none transition-all"
                placeholder="Search requests..."
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none transition-all text-[#44546f]"
              value={selectedRequestTypeId || ''}
              onChange={(e) => {
                setSelectedRequestTypeId(e.target.value || null);
                setPage(1);
              }}
            >
              <option value="">All request types</option>
              {requestTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>

          {/* Active filter indicator */}
          {viewMode !== 'all' && (
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#0052cc]/10 text-[#0052cc]">
                <span className="material-symbols-outlined text-[14px]">
                  {viewMode === 'created' ? 'person' : 'share'}
                </span>
                {getViewModeLabel()}
                <button
                  onClick={() => { setViewMode('all'); setPage(1); }}
                  className="ml-1 hover:text-[#003d99]"
                  aria-label="Clear filter"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
              <p className="font-semibold">Error loading requests</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {requests.length === 0 ? (
                <div className="p-12 text-center text-[#44546f]">
                  <span className="material-symbols-outlined text-5xl mb-4 block opacity-30">
                    {viewMode === 'shared' ? 'share' : 'inbox'}
                  </span>
                  <p className="font-semibold mb-2">No requests found</p>
                  <p className="text-sm">
                    {viewMode === 'shared'
                      ? 'No requests have been shared with you yet'
                      : searchTerm
                        ? 'Try adjusting your search'
                        : 'Create your first request to get started'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-[#44546f] text-[11px] uppercase tracking-widest font-bold">
                          <th className="px-6 py-4 w-12 text-center">Type</th>
                          <th className="px-6 py-4">Reference</th>
                          <th className="px-6 py-4">Summary</th>
                          <th className="px-6 py-4">Request Type</th>
                          <th className="px-6 py-4">Service Desk</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Created</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {requests.map((req) => (
                          <tr
                            key={req.id}
                            className="hover:bg-gray-50 border-t border-gray-100 cursor-pointer transition-colors"
                            onClick={() => navigate(`/request/${req.referenceNumber || req.id}`)}
                          >
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`material-symbols-outlined text-[20px] ${getServiceColor(
                                  req.serviceDesk?.code || ''
                                )}`}
                              >
                                {getServiceIcon(req.serviceDesk?.code || '')}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-[#0052cc]">
                              <span className="flex items-center gap-1">
                                {req.isConfidential && (
                                  <span className="material-symbols-outlined text-[14px] text-red-500" title="Confidential">lock</span>
                                )}
                                {req.referenceNumber}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold">{req.summary}</td>
                            <td className="px-6 py-4 text-[#44546f]">
                              {req.requestType?.name || '—'}
                            </td>
                            <td className="px-6 py-4 text-[#44546f]">
                              {req.serviceDesk?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1">
                                {req.slaPaused && (
                                  <span
                                    className="material-symbols-outlined text-[14px] text-blue-500"
                                    title="SLA timer paused — awaiting approval"
                                  >
                                    pause_circle
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${STATUS_CONFIG[req.status]?.bg || 'bg-gray-100'} ${STATUS_CONFIG[req.status]?.color || 'text-gray-600'}`}
                                >
                                  {STATUS_CONFIG[req.status]?.icon && (
                                    <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
                                      {STATUS_CONFIG[req.status].icon}
                                    </span>
                                  )}
                                  {STATUS_CONFIG[req.status]?.label || req.status}
                                </span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[#44546f] whitespace-nowrap">
                              {formatDate(req.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                    <span className="text-xs text-[#44546f]">
                      Showing {requests.length} of {total} requests
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 rounded hover:bg-white disabled:opacity-30 border border-transparent hover:border-gray-200"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        aria-label="Previous page"
                      >
                        <span className="material-symbols-outlined text-lg">chevron_left</span>
                      </button>
                      <span className="text-xs text-[#44546f] px-2">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="p-1 rounded hover:bg-white disabled:opacity-30 border border-transparent hover:border-gray-200"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                        aria-label="Next page"
                      >
                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyRequests;