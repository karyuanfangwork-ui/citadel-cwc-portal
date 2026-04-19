# Plan 4: Agent Dashboard & Reporting

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Agent Dashboard showing assigned tickets, unassigned queue, and SLA status, plus a Reporting page with key metrics (ticket volume, resolution time, agent workload) so admins and agents can manage work efficiently.

**Architecture:** Add a `/reports` API endpoint that aggregates data from the Request table using Prisma groupBy. Frontend gets two new pages: Agent Dashboard and Reports, both behind role-based access.

**Tech Stack:** Express, Prisma, React, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/controllers/reports.controller.ts` | Aggregation queries for dashboard metrics |
| Create | `backend/src/routes/reports.routes.ts` | Report API routes |
| Modify | `backend/src/routes/index.ts` | Mount reports routes |
| Create | `frontend/src/services/reports.service.ts` | Frontend API client for reports |
| Create | `frontend/pages/AgentDashboard.tsx` | Agent view: my queue, unassigned, SLA warnings |
| Create | `frontend/pages/Reports.tsx` | Admin reporting page with metrics |
| Modify | `frontend/App.tsx` | Add routes + nav links for new pages |

---

### Task 1: Reports Controller

**Files:**
- Create: `backend/src/controllers/reports.controller.ts`

- [ ] **Step 1: Create `backend/src/controllers/reports.controller.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

export class ReportsController {
  /**
   * GET /reports/summary
   * Returns high-level metrics: total tickets, open, resolved, avg resolution time
   */
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const [total, open, resolved, closedRequests] = await Promise.all([
        prisma.request.count(),
        prisma.request.count({
          where: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED', 'COMPLETED', 'PAYMENT_COMPLETED', 'REIMBURSEMENT_CLOSED'] } },
        }),
        prisma.request.count({
          where: { status: { in: ['RESOLVED', 'CLOSED', 'COMPLETED', 'PAYMENT_COMPLETED'] } },
        }),
        prisma.request.findMany({
          where: { resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        }),
      ]);

      // Calculate average resolution time in hours
      let avgResolutionHours = 0;
      if (closedRequests.length > 0) {
        const totalHours = closedRequests.reduce((sum, r) => {
          const diff = (r.resolvedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + diff;
        }, 0);
        avgResolutionHours = Math.round(totalHours / closedRequests.length);
      }

      const unassigned = await prisma.request.count({
        where: {
          assignedToId: null,
          status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
        },
      });

      res.json({
        status: 'success',
        data: { total, open, resolved, unassigned, avgResolutionHours },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reports/by-status
   * Returns ticket counts grouped by status
   */
  async byStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await prisma.request.groupBy({
        by: ['status'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      const data = groups.map((g) => ({ status: g.status, count: g._count.id }));
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reports/by-service-desk
   * Returns ticket counts grouped by service desk
   */
  async byServiceDesk(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await prisma.request.groupBy({
        by: ['serviceDeskId'],
        _count: { id: true },
      });

      const serviceDesks = await prisma.serviceDesk.findMany({
        select: { id: true, name: true, code: true },
      });

      const deskMap = new Map(serviceDesks.map((d) => [d.id, d]));

      const data = groups.map((g) => ({
        serviceDeskId: g.serviceDeskId,
        name: deskMap.get(g.serviceDeskId)?.name ?? 'Unknown',
        code: deskMap.get(g.serviceDeskId)?.code ?? '',
        count: g._count.id,
      }));

      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reports/by-priority
   * Returns ticket counts grouped by priority
   */
  async byPriority(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await prisma.request.groupBy({
        by: ['priority'],
        _count: { id: true },
      });

      const data = groups.map((g) => ({ priority: g.priority, count: g._count.id }));
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reports/agent-workload
   * Returns ticket counts per assigned agent
   */
  async agentWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await prisma.request.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { not: null },
          status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
        },
        _count: { id: true },
      });

      const agentIds = groups.map((g) => g.assignedToId!).filter(Boolean);
      const agents = await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      const agentMap = new Map(agents.map((a) => [a.id, a]));

      const data = groups.map((g) => ({
        agentId: g.assignedToId,
        name: agentMap.get(g.assignedToId!)
          ? `${agentMap.get(g.assignedToId!)!.firstName} ${agentMap.get(g.assignedToId!)!.lastName}`
          : 'Unknown',
        email: agentMap.get(g.assignedToId!)?.email ?? '',
        activeTickets: g._count.id,
      }));

      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reports/sla-status
   * Returns counts of tickets within SLA vs breached
   */
  async slaStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();

      const [withinSla, breached, noSla] = await Promise.all([
        prisma.request.count({
          where: {
            slaDueAt: { gt: now },
            status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
          },
        }),
        prisma.request.count({
          where: {
            slaDueAt: { lte: now },
            status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
          },
        }),
        prisma.request.count({
          where: {
            slaDueAt: null,
            status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
          },
        }),
      ]);

      res.json({
        status: 'success',
        data: { withinSla, breached, noSla },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportsController();
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/reports.controller.ts
git commit -m "feat: add reports controller with summary, status, priority, SLA metrics"
```

---

### Task 2: Reports Routes

**Files:**
- Create: `backend/src/routes/reports.routes.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create `backend/src/routes/reports.routes.ts`**

```typescript
import { Router } from 'express';
import reportsController from '../controllers/reports.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'AGENT'));

router.get('/summary', reportsController.getSummary);
router.get('/by-status', reportsController.byStatus);
router.get('/by-service-desk', reportsController.byServiceDesk);
router.get('/by-priority', reportsController.byPriority);
router.get('/agent-workload', reportsController.agentWorkload);
router.get('/sla-status', reportsController.slaStatus);

export default router;
```

- [ ] **Step 2: Mount in `backend/src/routes/index.ts`**

Add import:

```typescript
import reportsRoutes from './reports.routes';
```

Add mount:

```typescript
router.use('/reports', reportsRoutes);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/reports.routes.ts backend/src/routes/index.ts
git commit -m "feat: add reports routes (admin/agent only)"
```

---

### Task 3: Frontend Reports Service

**Files:**
- Create: `frontend/src/services/reports.service.ts`

- [ ] **Step 1: Create `frontend/src/services/reports.service.ts`**

```typescript
import api from './api';

export interface ReportSummary {
  total: number;
  open: number;
  resolved: number;
  unassigned: number;
  avgResolutionHours: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ServiceDeskCount {
  serviceDeskId: string;
  name: string;
  code: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface AgentWorkload {
  agentId: string;
  name: string;
  email: string;
  activeTickets: number;
}

export interface SlaStatus {
  withinSla: number;
  breached: number;
  noSla: number;
}

const reportsService = {
  async getSummary(): Promise<ReportSummary> {
    const response = await api.get('/reports/summary');
    return response.data.data;
  },

  async getByStatus(): Promise<StatusCount[]> {
    const response = await api.get('/reports/by-status');
    return response.data.data;
  },

  async getByServiceDesk(): Promise<ServiceDeskCount[]> {
    const response = await api.get('/reports/by-service-desk');
    return response.data.data;
  },

  async getByPriority(): Promise<PriorityCount[]> {
    const response = await api.get('/reports/by-priority');
    return response.data.data;
  },

  async getAgentWorkload(): Promise<AgentWorkload[]> {
    const response = await api.get('/reports/agent-workload');
    return response.data.data;
  },

  async getSlaStatus(): Promise<SlaStatus> {
    const response = await api.get('/reports/sla-status');
    return response.data.data;
  },
};

export default reportsService;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/reports.service.ts
git commit -m "feat: add frontend reports service"
```

---

### Task 4: Agent Dashboard Page

**Files:**
- Create: `frontend/pages/AgentDashboard.tsx`

- [ ] **Step 1: Create `frontend/pages/AgentDashboard.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import requestService from '../src/services/request.service';
import reportsService, { ReportSummary, SlaStatus } from '../src/services/reports.service';
import { STATUS_CONFIG } from '../constants';

interface RequestRow {
  id: string;
  referenceNumber: string;
  summary: string;
  status: string;
  priority: string;
  slaDueAt: string | null;
  createdAt: string;
  serviceDesk?: { name: string; code: string };
  requester?: { firstName: string; lastName: string };
}

export default function AgentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myTickets, setMyTickets] = useState<RequestRow[]>([]);
  const [unassigned, setUnassigned] = useState<RequestRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [slaStatus, setSlaStatus] = useState<SlaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'unassigned'>('my');

  useEffect(() => {
    async function load() {
      try {
        const [summaryData, slaData, myData, unassignedData] = await Promise.all([
          reportsService.getSummary(),
          reportsService.getSlaStatus(),
          requestService.getAllRequests({ assignedToId: user?.id, status: 'open', limit: 50 }),
          requestService.getAllRequests({ assignedToId: 'none', status: 'open', limit: 50 }),
        ]);
        setSummary(summaryData);
        setSlaStatus(slaData);
        setMyTickets(myData.data ?? []);
        setUnassigned(unassignedData.data ?? []);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  function isSlaBreached(slaDueAt: string | null): boolean {
    if (!slaDueAt) return false;
    return new Date(slaDueAt) < new Date();
  }

  function formatTimeLeft(slaDueAt: string | null): string {
    if (!slaDueAt) return 'No SLA';
    const diff = new Date(slaDueAt).getTime() - Date.now();
    if (diff < 0) {
      const hours = Math.abs(Math.floor(diff / 3600000));
      return `Breached ${hours}h ago`;
    }
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m left`;
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
  }

  const priorityColor: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-gray-100 text-gray-600',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]" />
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#101418] mb-6">Agent Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-[#5e718d]">My Open Tickets</p>
          <p className="text-3xl font-bold text-[#101418] mt-1">{myTickets.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-[#5e718d]">Unassigned</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{summary?.unassigned ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-[#5e718d]">SLA Breached</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{slaStatus?.breached ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-[#5e718d]">Avg Resolution</p>
          <p className="text-3xl font-bold text-[#101418] mt-1">{summary?.avgResolutionHours ?? 0}h</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'my' ? 'bg-white shadow text-[#101418]' : 'text-[#5e718d] hover:text-[#101418]'
          }`}
        >
          My Queue ({myTickets.length})
        </button>
        <button
          onClick={() => setActiveTab('unassigned')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'unassigned' ? 'bg-white shadow text-[#101418]' : 'text-[#5e718d] hover:text-[#101418]'
          }`}
        >
          Unassigned ({unassigned.length})
        </button>
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5e718d] uppercase">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5e718d] uppercase">Summary</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5e718d] uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5e718d] uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5e718d] uppercase">SLA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5e718d] uppercase">Requester</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'my' ? myTickets : unassigned).map((ticket) => {
                const statusCfg = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
                const breached = isSlaBreached(ticket.slaDueAt);
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/request/${ticket.id}`)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                      breached ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-[#0052cc]">{ticket.referenceNumber}</td>
                    <td className="px-4 py-3 text-sm text-[#101418] max-w-xs truncate">{ticket.summary}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${priorityColor[ticket.priority] ?? ''}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusCfg?.bg ?? ''} ${statusCfg?.color ?? ''}`}>
                        {statusCfg?.label ?? ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${breached ? 'text-red-600' : 'text-[#5e718d]'}`}>
                        {formatTimeLeft(ticket.slaDueAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5e718d]">
                      {ticket.requester ? `${ticket.requester.firstName} ${ticket.requester.lastName}` : '-'}
                    </td>
                  </tr>
                );
              })}
              {(activeTab === 'my' ? myTickets : unassigned).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#5e718d]">
                    <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                    {activeTab === 'my' ? 'No tickets assigned to you' : 'No unassigned tickets'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/AgentDashboard.tsx
git commit -m "feat: add agent dashboard with my queue, unassigned, SLA indicators"
```

---

### Task 5: Reports Page

**Files:**
- Create: `frontend/pages/Reports.tsx`

- [ ] **Step 1: Create `frontend/pages/Reports.tsx`**

```tsx
import { useState, useEffect } from 'react';
import reportsService, {
  ReportSummary,
  StatusCount,
  ServiceDeskCount,
  PriorityCount,
  AgentWorkload,
  SlaStatus,
} from '../src/services/reports.service';

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [byStatus, setByStatus] = useState<StatusCount[]>([]);
  const [byDesk, setByDesk] = useState<ServiceDeskCount[]>([]);
  const [byPriority, setByPriority] = useState<PriorityCount[]>([]);
  const [workload, setWorkload] = useState<AgentWorkload[]>([]);
  const [sla, setSla] = useState<SlaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, st, d, p, w, sl] = await Promise.all([
          reportsService.getSummary(),
          reportsService.getByStatus(),
          reportsService.getByServiceDesk(),
          reportsService.getByPriority(),
          reportsService.getAgentWorkload(),
          reportsService.getSlaStatus(),
        ]);
        setSummary(s);
        setByStatus(st);
        setByDesk(d);
        setByPriority(p);
        setWorkload(w);
        setSla(sl);
      } catch (err) {
        console.error('Failed to load reports', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]" />
      </div>
    );
  }

  const priorityColor: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-gray-400',
  };

  const totalPriority = byPriority.reduce((s, p) => s + p.count, 0) || 1;
  const totalSla = (sla ? sla.withinSla + sla.breached + sla.noSla : 1) || 1;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#101418] mb-6">Reports & Analytics</h1>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Tickets', value: summary?.total ?? 0, color: 'text-[#101418]' },
          { label: 'Open', value: summary?.open ?? 0, color: 'text-blue-600' },
          { label: 'Resolved', value: summary?.resolved ?? 0, color: 'text-green-600' },
          { label: 'Unassigned', value: summary?.unassigned ?? 0, color: 'text-amber-600' },
          { label: 'Avg Resolution', value: `${summary?.avgResolutionHours ?? 0}h`, color: 'text-[#101418]' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-[#5e718d]">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* By Service Desk */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#101418] mb-4">By Service Desk</h2>
          {byDesk.map((d) => (
            <div key={d.serviceDeskId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-[#101418]">{d.name}</span>
              <span className="text-sm font-semibold text-[#101418] bg-gray-100 px-3 py-1 rounded-full">{d.count}</span>
            </div>
          ))}
          {byDesk.length === 0 && <p className="text-sm text-[#5e718d]">No data</p>}
        </div>

        {/* By Priority */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#101418] mb-4">By Priority</h2>
          {byPriority.map((p) => (
            <div key={p.priority} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#101418]">{p.priority}</span>
                <span className="text-[#5e718d]">{p.count} ({Math.round((p.count / totalPriority) * 100)}%)</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${priorityColor[p.priority] ?? 'bg-gray-400'}`}
                  style={{ width: `${(p.count / totalPriority) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* SLA Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#101418] mb-4">SLA Compliance</h2>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{sla?.withinSla ?? 0}</p>
              <p className="text-xs text-green-700 mt-1">Within SLA</p>
            </div>
            <div className="flex-1 text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{sla?.breached ?? 0}</p>
              <p className="text-xs text-red-700 mt-1">Breached</p>
            </div>
            <div className="flex-1 text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{sla?.noSla ?? 0}</p>
              <p className="text-xs text-gray-600 mt-1">No SLA Set</p>
            </div>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            <div className="bg-green-500 h-full" style={{ width: `${((sla?.withinSla ?? 0) / totalSla) * 100}%` }} />
            <div className="bg-red-500 h-full" style={{ width: `${((sla?.breached ?? 0) / totalSla) * 100}%` }} />
          </div>
        </div>

        {/* Agent Workload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#101418] mb-4">Agent Workload</h2>
          {workload.length === 0 && <p className="text-sm text-[#5e718d]">No active assignments</p>}
          {workload
            .sort((a, b) => b.activeTickets - a.activeTickets)
            .map((agent) => (
              <div key={agent.agentId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#101418]">{agent.name}</p>
                  <p className="text-xs text-[#5e718d]">{agent.email}</p>
                </div>
                <span className="text-sm font-semibold text-[#101418] bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                  {agent.activeTickets}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* By Status — full width */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-[#101418] mb-4">By Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {byStatus.map((s) => (
            <div key={s.status} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xl font-bold text-[#101418]">{s.count}</p>
              <p className="text-xs text-[#5e718d] mt-1">{s.status.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/Reports.tsx
git commit -m "feat: add reports page with summary, priority, SLA, workload metrics"
```

---

### Task 6: Wire New Pages into App Router

**Files:**
- Modify: `frontend/App.tsx`

- [ ] **Step 1: Add imports at top of `App.tsx`**

```typescript
import AgentDashboard from './pages/AgentDashboard';
import Reports from './pages/Reports';
```

- [ ] **Step 2: Add routes inside the `<Routes>` block**

Add alongside existing protected routes:

```tsx
<Route path="/agent" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
<Route path="/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
```

- [ ] **Step 3: Add navigation links in the header**

In the nav section, add these links (after "My Requests" and before "Knowledge Base"):

```tsx
{user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT') ? (
  <a href="#/agent" className="text-[#0e141b] text-sm font-medium">Agent Dashboard</a>
) : null}
{user?.roles?.includes('ADMIN') && (
  <a href="#/reports" className="text-[#0e141b] text-sm font-medium">Reports</a>
)}
```

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npm run build`

- [ ] **Step 5: Commit**

```bash
git add frontend/App.tsx
git commit -m "feat: add agent dashboard and reports routes with nav links"
```

---

## Summary

After completing all 6 tasks:
- Backend provides 6 report endpoints: summary, by-status, by-service-desk, by-priority, agent-workload, sla-status
- Agent Dashboard shows: personal queue, unassigned tickets, SLA countdown per ticket, summary cards
- Reports page shows: ticket volume metrics, priority distribution bars, SLA compliance, agent workload ranking, status breakdown grid
- Both pages are role-gated (agent/admin for dashboard, admin for reports)
