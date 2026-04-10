import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { STATUS_CONFIG } from '../constants';
import reportsService, { ReportSummary, SlaStatus } from '../src/services/reports.service';
import api from '../src/services/api';

interface TicketRow {
  id: string;
  reference: string;
  summary: string;
  priority: string;
  status: string;
  slaDeadline?: string | null;
  requester?: { firstName: string; lastName: string; email: string } | null;
}

function getSlaDisplay(slaDeadline?: string | null): { label: string; breached: boolean } {
  if (!slaDeadline) return { label: 'No SLA', breached: false };
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) {
    const hoursAgo = Math.round(Math.abs(diffMs) / 3600000);
    return { label: `Breached ${hoursAgo}h ago`, breached: true };
  }
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return { label: `${diffMins}m left`, breached: false };
  const diffHours = Math.round(diffMs / 3600000);
  if (diffHours < 24) return { label: `${diffHours}h left`, breached: false };
  const diffDays = Math.round(diffMs / 86400000);
  return { label: `${diffDays}d left`, breached: false };
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
  HIGH: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  LOW: { label: 'Low', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'mine' | 'unassigned'>('mine');
  const [myTickets, setMyTickets] = useState<TicketRow[]>([]);
  const [unassignedTickets, setUnassignedTickets] = useState<TicketRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [slaStatus, setSlaStatus] = useState<SlaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [summaryData, slaData, myRes, unRes] = await Promise.all([
          reportsService.getSummary(),
          reportsService.getSlaStatus(),
          api.get('/requests', { params: { assignedToId: user?.id, limit: 50 } }),
          api.get('/requests', { params: { assignedToId: 'none', limit: 50 } }),
        ]);
        setSummary(summaryData);
        setSlaStatus(slaData);

        const extractTickets = (res: any): TicketRow[] => {
          const raw = res.data?.data;
          const arr = Array.isArray(raw) ? raw : (raw?.requests ?? []);
          return arr.map((r: any) => ({
            id: r.id,
            reference: r.reference ?? r.id,
            summary: r.summary,
            priority: r.priority ?? 'MEDIUM',
            status: r.status,
            slaDeadline: r.slaDeadline ?? r.sla_deadline ?? null,
            requester: r.requester ?? r.requestedBy ?? null,
          }));
        };

        setMyTickets(extractTickets(myRes));
        setUnassignedTickets(extractTickets(unRes));
      } catch (err) {
        console.error('AgentDashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id]);

  const tickets = activeTab === 'mine' ? myTickets : unassignedTickets;

  const cards = [
    {
      label: 'My Open Tickets',
      value: myTickets.filter(t => !['RESOLVED', 'COMPLETED', 'REJECTED', 'CEO_REJECTED', 'MANAGER_REJECTED_IT', 'MANAGER_REJECTED_FIN', 'FINANCE_HEAD_REJECTED', 'CANDIDATE_REJECTED_INTERVIEW', 'REIMBURSEMENT_CLOSED'].includes(t.status)).length,
      icon: 'confirmation_number',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Unassigned',
      value: unassignedTickets.length,
      icon: 'inbox',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'SLA Breached',
      value: slaStatus?.breached ?? 0,
      icon: 'timer_off',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Avg Resolution',
      value: summary ? `${Math.round(summary.avgResolutionHours)}h` : '—',
      icon: 'avg_pace',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {user?.firstName}. Here's your queue overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`material-symbols-outlined ${card.color} text-2xl`}>{card.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{loading ? '—' : card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'mine'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Queue
          {!loading && myTickets.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {myTickets.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('unassigned')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'unassigned'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Unassigned
          {!loading && unassignedTickets.length > 0 && (
            <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {unassignedTickets.length}
            </span>
          )}
        </button>
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <span className="material-symbols-outlined text-5xl">inbox</span>
            <p className="text-base font-medium">No tickets here</p>
            <p className="text-sm">
              {activeTab === 'mine' ? 'You have no tickets assigned to you.' : 'No unassigned tickets at the moment.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Ref</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">SLA</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-44">Requester</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map(ticket => {
                const sla = getSlaDisplay(ticket.slaDeadline);
                const priorityCfg = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.MEDIUM;
                const statusCfg = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
                const requesterName = ticket.requester
                  ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                  : '—';

                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/request/${ticket.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 ${sla.breached ? 'bg-red-50 hover:bg-red-100' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 font-medium">{ticket.reference}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{ticket.summary}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {statusCfg ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{ticket.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${sla.breached ? 'text-red-600' : sla.label === 'No SLA' ? 'text-gray-400' : 'text-green-600'}`}>
                        {sla.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[11rem]">{requesterName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
