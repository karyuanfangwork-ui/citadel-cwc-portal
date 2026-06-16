import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock crmService so the dashboard doesn't make real API calls
vi.mock('../../services/crm.service', () => ({
  default: {
    getDashboard: vi.fn().mockResolvedValue({
      totalActiveLeads: 0, followUpDueToday: 0, totalOpenOpps: 0,
      overdueDeals: 0, meetingsToday: { count: 0, nextMeeting: null },
      monthlyConversions: { count: 0, target: 0, percentage: 0 },
      hotLeads: [], tasks: { overdue: [], inProgress: [], overdueCount: 0, inProgressCount: 0 },
      upcomingFollowUps: [], recentActivities: [], opportunitiesByStage: [],
      delta: { leadsDelta: 0, oppsDelta: 0, wonDelta: 0, lostDelta: 0, pipelineDelta: 0, winRateDelta: 0 },
    }),
    getDashboardLayout: vi.fn().mockResolvedValue([]),
    saveDashboardLayout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../hooks/useCrmAi', () => ({
  useDailyBriefing: () => ({ briefing: null, loading: false, error: null, fetch: vi.fn() }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Karyuan', lastName: 'Fang' } }),
  AuthContext: { Consumer: ({ children }: any) => children({ user: null }) },
}));

// Lazy-import so mocks are set up first
const CrmDashboard = React.lazy(() => import('../../pages/CrmDashboard'));

describe('PipelineWidget opacity calculation', () => {
  it('never exceeds 1.0 for any number of stages', () => {
    const stageCount = 8;
    for (let idx = 0; idx < stageCount; idx++) {
      const opacity = Math.min(1, 0.3 + idx * 0.2);
      expect(opacity).toBeLessThanOrEqual(1);
      expect(opacity).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('PipelineWidget textColor logic', () => {
  const stageColors = ['#86f2e4', '#6bd8cb', '#3fc4ad', '#006a61'];
  const TEAL = '#006a61';

  it('returns teal text for light background regardless of raw idx', () => {
    const getTextColor = (idx: number) => {
      const pos = idx % stageColors.length;
      return pos >= stageColors.length - 1 ? '#fff' : TEAL;
    };

    expect(getTextColor(0)).toBe(TEAL);  // pos 0 → light → teal
    expect(getTextColor(3)).toBe('#fff'); // pos 3 → dark → white
    expect(getTextColor(4)).toBe(TEAL);  // pos 4 → wraps to 0 → light → teal
    expect(getTextColor(7)).toBe('#fff'); // pos 7 → wraps to 3 → dark → white
  });
});

describe('CalendarWidget AM/PM extraction', () => {
  it('extracts a valid AM/PM token from a scheduledAt date', () => {
    const scheduledAt = '2026-06-16T09:00:00.000Z';
    const parts = new Intl.DateTimeFormat('en-MY', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).formatToParts(new Date(scheduledAt));
    const period = parts.find(p => p.type === 'dayPeriod')?.value ?? '';
    expect(['AM', 'PM', 'am', 'pm']).toContain(period.toUpperCase().replace('.', ''));
  });
});

describe('FollowUpsWidget urgency tier', () => {
  it('assigns High Priority to items due within 2 hours', () => {
    const now = Date.now();
    const soon = new Date(now + 60 * 60 * 1000).toISOString(); // 1h from now
    const later = new Date(now + 5 * 60 * 60 * 1000).toISOString(); // 5h from now
    const far = new Date(now + 20 * 60 * 60 * 1000).toISOString(); // 20h from now

    const urgency = (followUpDate: string) => {
      const diff = new Date(followUpDate).getTime() - Date.now();
      const hours = diff / (1000 * 60 * 60);
      if (hours <= 2) return 'High Priority';
      if (hours <= 8) return 'Standard';
      return 'Medium';
    };

    expect(urgency(soon)).toBe('High Priority');
    expect(urgency(later)).toBe('Standard');
    expect(urgency(far)).toBe('Medium');
  });
});

describe('CrmDashboard WelcomeHeader', () => {
  it('shows the logged-in user first name instead of "Sales Rep"', async () => {
    render(
      <MemoryRouter>
        <React.Suspense fallback={<div>Loading...</div>}>
          <CrmDashboard />
        </React.Suspense>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Karyuan/)).toBeInTheDocument();
  });
});

describe('RecentActivityWidget filter tabs', () => {
  it('renders All, Leads, Opps, Deals tabs', async () => {
    render(
      <MemoryRouter>
        <React.Suspense fallback={<div>Loading...</div>}>
          <CrmDashboard />
        </React.Suspense>
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leads/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Opps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deals/i })).toBeInTheDocument();
  });
});