import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestService } from '../src/services/request.service';
import { STATUS_CONFIG } from '../constants';

interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  serviceDesk?: {
    id: string;
    name: string;
    code: string;
  };
}

const MyRequests = () => {
  const [filter, setFilter] = useState('open');
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchRequests();
  }, [filter, searchTerm, page]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {
        page,
        limit,
      };

      if (searchTerm) {
        filters.search = searchTerm;
      }

      // Filter by status
      if (filter === 'open') {
        // For open requests, we'll fetch all and filter on frontend
        // In production, backend should support status filtering
      }

      const data = await requestService.getAllRequests(filters);

      let filteredRequests = data.requests || [];

      // Client-side filtering for open requests
      if (filter === 'open') {
        filteredRequests = filteredRequests.filter(
          (r: Request) => r.status !== 'RESOLVED' && r.status !== 'CLOSED'
        );
      }

      setRequests(filteredRequests);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
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

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <h1 className="text-[#101418] text-3xl font-extrabold tracking-tight mb-8">My Requests</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setFilter('open');
                setPage(1);
              }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${filter === 'open'
                  ? 'bg-[#0052cc]/10 text-[#0052cc] font-bold border-l-4 border-[#0052cc]'
                  : 'text-[#44546f] hover:bg-gray-100'
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">drafts</span>
              Open requests
            </button>
            <button
              onClick={() => {
                setFilter('all');
                setPage(1);
              }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${filter === 'all'
                  ? 'bg-[#0052cc]/10 text-[#0052cc] font-bold border-l-4 border-[#0052cc]'
                  : 'text-[#44546f] hover:bg-gray-100'
                }`}
            >
              <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
              All requests
            </button>
            <div className="h-px bg-gray-200 my-2"></div>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-2.5 rounded text-sm text-[#44546f] hover:bg-gray-100 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
              Created by me
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-2.5 rounded text-sm text-[#44546f] hover:bg-gray-100 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
              Shared with me
            </a>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5e718d] text-xl">
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
          </div>

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
                <div className="p-12 text-center text-[#5e718d]">
                  <span className="material-symbols-outlined text-5xl mb-4 block opacity-30">
                    inbox
                  </span>
                  <p className="font-semibold mb-2">No requests found</p>
                  <p className="text-sm">
                    {searchTerm
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
                            onClick={() => (window.location.hash = `#/request/${req.id}`)}
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
                              {req.referenceNumber}
                            </td>
                            <td className="px-6 py-4 font-semibold">{req.summary}</td>
                            <td className="px-6 py-4 text-[#44546f]">
                              {req.serviceDesk?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${STATUS_CONFIG[req.status]?.bg || 'bg-gray-100'
                                  } ${STATUS_CONFIG[req.status]?.color || 'text-gray-600'}`}
                              >
                                {STATUS_CONFIG[req.status]?.label || req.status}
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
