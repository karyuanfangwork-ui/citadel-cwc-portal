import { Link } from 'react-router-dom';
import { DashboardTicket } from '../../services/agent-dashboard.service';
import { STATUS_CONFIG } from '../../../constants';
import { slaPresentation } from './slaPresentation';
import { stripHtml } from '../../utils/format';

interface Props { tickets: DashboardTicket[]; canExport: boolean; selectedIds: Set<string>; onToggle: (id: string) => void; onTogglePage: () => void; onExport: () => void; exporting: boolean; }
export function TicketTable({ tickets, canExport, selectedIds, onToggle, onTogglePage, onExport, exporting }: Props) {
  const visibleSelectedCount = tickets.reduce((count, ticket) => count + Number(selectedIds.has(ticket.id)), 0);
  const allSelected = tickets.length > 0 && visibleSelectedCount === tickets.length;
  const someSelected = visibleSelectedCount > 0;
  const headerRef = (element: HTMLInputElement | null) => { if (element) element.indeterminate = someSelected && !allSelected; };
  return <section aria-label="Ticket results" className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    {canExport && visibleSelectedCount > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <button type="button" onClick={onExport} disabled={exporting} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{exporting ? 'Exporting…' : `Export ${visibleSelectedCount} selected tickets on this page`}</button>
    </div>}
    <div className="overflow-x-auto">
      <table className="min-w-[1080px] w-full text-left text-sm">
        <caption className="sr-only">Agent dashboard tickets</caption>
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300"><tr>
          {canExport && <th className="w-10 px-3 py-3"><input ref={headerRef} type="checkbox" aria-label="Select all tickets on this page" checked={allSelected} onChange={onTogglePage} /></th>}
          <th className="px-3 py-3">Reference</th><th className="px-3 py-3">Summary</th><th className="px-3 py-3">Request type</th><th className="px-3 py-3">Assignee / team</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Resolution SLA</th><th className="px-3 py-3">Requester</th><th className="px-3 py-3">Updated</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{tickets.map((ticket) => {
          const summary = stripHtml(ticket.summary);
          const sla = slaPresentation(ticket.sla.state, ticket.sla.remainingMs);
          const status = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
          return <tr key={ticket.id} className={`${ticket.sla.state === 'BREACHED' && !ticket.isTerminal ? 'border-l-2 border-l-red-500' : ''} hover:bg-gray-50 dark:hover:bg-gray-800`}>
            {canExport && <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${ticket.reference}`} checked={selectedIds.has(ticket.id)} onChange={() => onToggle(ticket.id)} /></td>}
            <td className="whitespace-nowrap px-3 py-3 font-mono text-xs"><Link className="text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" to={`/request/${ticket.reference}`}>{ticket.reference}</Link></td>
            <td className="max-w-sm px-3 py-3 text-gray-900 dark:text-gray-100"><div className="line-clamp-2">{summary}</div><details className="mt-1 text-xs text-gray-500"><summary className="cursor-pointer">Full summary</summary><p className="mt-1 whitespace-pre-wrap">{summary}</p></details></td>
            <td className="px-3 py-3">{ticket.requestType?.name ?? '—'}</td>
            <td className="px-3 py-3">{ticket.assignee?.name ?? 'Unassigned'}{ticket.assignedTeam && <span className="block text-xs text-gray-500">{ticket.assignedTeam}</span>}</td>
            <td className="px-3 py-3">{ticket.priority}</td><td className="px-3 py-3">{status?.label ?? ticket.status}</td>
            <td className="px-3 py-3"><span className={`inline-flex rounded px-2 py-1 text-xs ${sla.className}`}>{sla.label}</span>{ticket.sla.dueAt && <details className="mt-1 text-xs text-gray-500"><summary className="cursor-pointer">Deadline</summary><time dateTime={ticket.sla.dueAt}>{new Date(ticket.sla.dueAt).toLocaleString()}</time></details>}</td>
            <td className="px-3 py-3">{ticket.requester?.name ?? '—'}</td><td className="whitespace-nowrap px-3 py-3">{new Date(ticket.updatedAt).toLocaleString()}</td>
          </tr>;
        })}</tbody>
      </table>
      {tickets.length === 0 && <div className="p-12 text-center"><h3 className="font-semibold text-gray-900 dark:text-gray-100">No tickets in this queue</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Try another queue or clear the active filters.</p></div>}
    </div>
  </section>;
}
