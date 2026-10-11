import { DashboardTicket } from '../../services/agent-dashboard.service';
import { slaPresentation } from './slaPresentation';

interface Props { total: number; tickets: DashboardTicket[]; onViewOpen: () => void; onNavigate: (ticket: DashboardTicket) => void; }
export function AttentionQueue({ total, tickets, onViewOpen, onNavigate }: Props) {
  if (!total) return null;
  return <section aria-labelledby="agent-attention-heading" className="mb-5 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-700 dark:bg-amber-950/20">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="agent-attention-heading" className="font-semibold text-gray-900 dark:text-gray-100">Needs attention <span className="ml-1 text-sm">({total})</span></h2><p className="text-xs text-gray-600 dark:text-gray-300">Active breached, due-soon, and high-priority work in this scope.</p></div>
      <button type="button" onClick={onViewOpen} className="rounded px-2 py-1 text-sm font-medium text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">View open work</button>
    </div>
    <ul className="grid gap-2 md:grid-cols-3">{tickets.map((ticket) => {
      const sla = slaPresentation(ticket.sla.state, ticket.sla.remainingMs);
      return <li key={ticket.id}><button type="button" onClick={() => onNavigate(ticket)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-900">
        <span className="min-w-0"><span className="block font-mono text-xs text-gray-600 dark:text-gray-300">{ticket.reference}</span><span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{ticket.summary}</span></span>
        <span className={`shrink-0 rounded px-2 py-1 text-xs ${sla.className}`}>{sla.label}</span>
      </button></li>;
    })}</ul>
  </section>;
}
