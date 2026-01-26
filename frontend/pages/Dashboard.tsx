import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { serviceDeskService } from '../src/services/serviceDesk.service';
import { requestService } from '../src/services/request.service';
import { STATUS_CONFIG } from '../constants';

interface ServiceDesk {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

interface Request {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  serviceDesk?: {
    name: string;
    code: string;
  };
}

const Dashboard = () => {
  const [serviceDesks, setServiceDesks] = useState<ServiceDesk[]>([]);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch service desks and recent requests in parallel
        const [desksData, requestsData] = await Promise.all([
          serviceDeskService.getAllServiceDesks(),
          requestService.getAllRequests({ limit: 5 })
        ]);

        setServiceDesks(desksData);
        setRecentRequests(requestsData.requests || []);
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Map service desk to icon and color
  const getServiceDeskStyle = (code: string) => {
    const styles: Record<string, { icon: string; color: string }> = {
      IT: { icon: 'devices', color: 'bg-blue-50 text-blue-600' },
      HR: { icon: 'groups', color: 'bg-emerald-50 text-emerald-600' },
      FINANCE: { icon: 'payments', color: 'bg-amber-50 text-amber-600' },
    };
    return styles[code] || { icon: 'help', color: 'bg-gray-50 text-gray-600' };
  };

  // Format date to relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-12">
      <div className="text-center mb-16">
        <h1 className="text-[#101418] text-5xl font-black tracking-tight mb-6">
          How can we help you today?
        </h1>
        <div className="max-w-2xl mx-auto relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#5e718d] text-2xl group-focus-within:text-[#0052cc]">
            search
          </span>
          <input
            type="text"
            placeholder="Search for hardware, benefits, expenses..."
            className="w-full h-16 pl-14 pr-32 bg-white border-2 border-transparent shadow-xl shadow-gray-200/50 rounded-2xl text-lg focus:border-[#0052cc] focus:ring-0 outline-none transition-all"
          />
          <button className="absolute right-3 top-3 bottom-3 px-8 bg-[#0052cc] text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Search
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm text-[#5e718d]">
          <span>Common:</span>
          <a href="#" className="font-semibold text-[#0052cc] hover:underline">
            VPN Setup
          </a>
          <a href="#" className="font-semibold text-[#0052cc] hover:underline">
            Reset Password
          </a>
          <a href="#" className="font-semibold text-[#0052cc] hover:underline">
            Payroll Calendar
          </a>
        </div>
      </div>

      {/* Service Desks */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-8">
          <p className="font-semibold">Error loading dashboard</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {serviceDesks.map((desk) => {
              const style = getServiceDeskStyle(desk.code);
              return (
                <Link
                  key={desk.id}
                  to={`/${desk.code.toLowerCase()}`}
                  className="group p-8 bg-white border border-gray-100 rounded-2xl hover:shadow-2xl hover:shadow-[#0052cc]/5 hover:border-[#0052cc]/20 transition-all"
                >
                  <div
                    className={`w-14 h-14 ${style.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <span className="material-symbols-outlined text-3xl">{style.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{desk.name}</h3>
                  <p className="text-[#5e718d] leading-relaxed">
                    {desk.description || 'Manage your requests and services'}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Recent Requests */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent requests</h2>
              <Link to="/my-requests" className="text-sm font-bold text-[#0052cc] hover:underline">
                View all
              </Link>
            </div>
            {recentRequests.length === 0 ? (
              <div className="p-12 text-center text-[#5e718d]">
                <span className="material-symbols-outlined text-5xl mb-4 block opacity-30">
                  inbox
                </span>
                <p className="font-semibold mb-2">No requests yet</p>
                <p className="text-sm">Create your first request to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-[#5e718d] text-[11px] font-bold uppercase tracking-widest">
                      <th className="px-6 py-4">Reference</th>
                      <th className="px-6 py-4">Summary</th>
                      <th className="px-6 py-4">Service</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentRequests.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => (window.location.hash = `#/request/${req.id}`)}
                      >
                        <td className="px-6 py-5 font-mono text-sm font-bold text-[#0052cc]">
                          {req.referenceNumber}
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold">{req.summary}</td>
                        <td className="px-6 py-5 text-sm text-[#5e718d]">
                          {req.serviceDesk?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${STATUS_CONFIG[req.status]?.bg || 'bg-gray-100'
                              } ${STATUS_CONFIG[req.status]?.color || 'text-gray-600'}`}
                          >
                            {STATUS_CONFIG[req.status]?.label || req.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-sm text-[#5e718d]">
                          {formatRelativeTime(req.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-16 text-center">
        <p className="text-[#5e718d] mb-6">Can't find what you're looking for?</p>
        <div className="flex items-center justify-center gap-4">
          <button className="flex items-center gap-3 px-8 py-3 bg-white border border-gray-200 rounded-xl font-bold hover:border-[#0052cc] hover:text-[#0052cc] transition-all">
            <span className="material-symbols-outlined">menu_book</span>
            Browse Knowledge Base
          </button>
          <button className="flex items-center gap-3 px-8 py-3 bg-white border border-gray-200 rounded-xl font-bold hover:border-[#0052cc] hover:text-[#0052cc] transition-all">
            <span className="material-symbols-outlined">forum</span>
            Chat with Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
