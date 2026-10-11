import { DashboardQueue } from '../../services/agent-dashboard.service';

interface Props { queue: DashboardQueue; counts: { open: number; closed: number; all: number; unassigned: number }; showUnassigned: boolean; onChange: (queue: DashboardQueue) => void; }
const tabs: { key: DashboardQueue; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'closed', label: 'Closed' }, { key: 'all', label: 'All' }, { key: 'unassigned', label: 'Unassigned' },
];
export function DashboardTabs({ queue, counts, showUnassigned, onChange }: Props) {
  return <div role="tablist" aria-label="Request queues" className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
    {tabs.filter((tab) => tab.key !== 'unassigned' || showUnassigned).map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={queue === tab.key} onClick={() => onChange(tab.key)} className={`border-b-2 px-3 py-2 text-sm ${queue === tab.key ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-300'}`}>
      {tab.label}<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{counts[tab.key]}</span>
    </button>)}
  </div>;
}
