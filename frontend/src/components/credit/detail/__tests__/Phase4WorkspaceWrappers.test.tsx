import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AssessmentRecommendationWorkspace from '../AssessmentRecommendationWorkspace';
import DecisionCompletionWorkspace from '../DecisionCompletionWorkspace';

vi.mock('../../../../../pages/credit/tabs/sections/QualitativeAssessmentTab', () => ({ default: ({ readOnly }: { readOnly?: boolean }) => <div>qualitative editor {readOnly ? 'read-only' : 'editable'}</div> }));
vi.mock('../../../../../pages/credit/tabs/sections/IndustryOutlookTab', () => ({ default: ({ readOnly }: { readOnly?: boolean }) => <div>industry editor {readOnly ? 'read-only' : 'editable'}</div> }));
vi.mock('../../../../../pages/credit/tabs/CaMemoPreviewTab', () => ({ default: () => <div>CA memo preview</div> }));
vi.mock('../../../../../pages/credit/tabs/sections/ApprovalsTab', () => ({ default: () => <div>approval chain</div> }));
vi.mock('../../../../../pages/credit/tabs/SignoffTab', () => ({ default: () => <div>sign-off</div> }));
vi.mock('../../../../../pages/credit/tabs/ConditionsOfferTab', () => ({ default: () => <div>conditions and offer</div> }));
vi.mock('../../../../../pages/credit/tabs/DisbursementTab', () => ({ default: () => <div>disbursement handoff</div> }));
vi.mock('../../../../../pages/credit/tabs/TimelineAuditTab', () => ({ default: () => <div>decision history</div> }));
vi.mock('../../RecommendationSection', () => ({ default: () => <div>recommendation editor</div> }));
vi.mock('../../ApprovalMatrixApplicabilityPanel', () => ({ default: () => <div>approval matrix</div> }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'analyst-1' } }) }));

const application = {
  id: 'app-1', applicationNo: 'APP-1', state: 'DRAFT', riskRating: 'BBB', totalScore: 72,
  dscr: 1.4, calculationSource: 'scorecard', missingInputs: [], isOverride: false,
  requestedAmount: 100000, requestedTenor: 60, productType: 'TERM_LOAN', currency: 'MYR',
} as any;

const flags = () => true;

describe('AssessmentRecommendationWorkspace', () => {
  it('renders the analyst assessment composition without approvals', () => {
    render(<AssessmentRecommendationWorkspace application={application} activeTab="assessment" isFeatureEnabled={flags} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Analyst Assessment' })).toBeInTheDocument();
    expect(screen.getByText(/qualitative editor/)).toBeInTheDocument();
    expect(screen.getByText(/industry editor/)).toBeInTheDocument();
    expect(screen.getByText('Assessment Evidence')).toBeInTheDocument();
    expect(screen.queryByText('approval matrix')).not.toBeInTheDocument();
  });

  it('keeps assessment editable during the analyst assessment and refer-back states', () => {
    render(<AssessmentRecommendationWorkspace application={{ ...application, state: 'CREDIT_ASSESSMENT' } as any} activeTab="assessment" isFeatureEnabled={flags} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('qualitative editor editable')).toBeInTheDocument();
    expect(screen.getByText('industry editor editable')).toBeInTheDocument();

    cleanup();
    render(<AssessmentRecommendationWorkspace application={{ ...application, state: 'REFERRED_BACK' } as any} activeTab="assessment" isFeatureEnabled={flags} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('qualitative editor editable')).toBeInTheDocument();
  });

  it('renders submitted assessment evidence read-only after committee submission', () => {
    render(<AssessmentRecommendationWorkspace application={{ ...application, state: 'COMMITTEE_REVIEW' } as any} activeTab="assessment" isFeatureEnabled={flags} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('qualitative editor read-only')).toBeInTheDocument();
    expect(screen.getByText('industry editor read-only')).toBeInTheDocument();
  });

  it.each([
    ['recommendation', 'recommendation editor'],
    ['ca-memo', 'CA memo preview'],
    ['deviations-mitigants', 'No recorded deviations or mitigants.'],
  ] as const)('renders only the %s destination', (tab, content) => {
    render(<AssessmentRecommendationWorkspace application={application} activeTab={tab} isFeatureEnabled={flags} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('labels requested terms separately from the analyst recommendation', () => {
    render(<AssessmentRecommendationWorkspace application={application} activeTab="recommendation" isFeatureEnabled={flags} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('Requested Terms')).toBeInTheDocument();
    expect(screen.getByText(/RM 100,000/)).toBeInTheDocument();
    expect(screen.getByText(/60 months/)).toBeInTheDocument();
  });
});

describe('DecisionCompletionWorkspace', () => {
  it('renders approvals and sign-off without the editable recommendation section', () => {
    render(<DecisionCompletionWorkspace application={application} facilities={[{ id: 'facility-1', facilityType: 'TERM_LOAN', amount: 80000, tenorMonths: 48, approvedAmount: 80000, approvedTenor: 48, approvedRate: 5.5, purpose: null, createdAt: '', updatedAt: '' } as any]} activeTab="approvals" onRefresh={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Approval Chain' })).toBeInTheDocument();
    expect(screen.getByText('approval matrix')).toBeInTheDocument();
    expect(screen.getByText('sign-off')).toBeInTheDocument();
    expect(screen.queryByText('recommendation editor')).not.toBeInTheDocument();
    expect(screen.getByText('Approved Terms')).toBeInTheDocument();
    expect(screen.getByText(/RM 80,000/)).toBeInTheDocument();
    expect(screen.getByText(/48 months/)).toBeInTheDocument();
  });

  it.each([
    ['decision-history', 'decision history'],
    ['conditions-offer', 'conditions and offer'],
    ['completion', 'disbursement handoff'],
  ] as const)('renders the %s destination', (tab, content) => {
    render(<DecisionCompletionWorkspace application={application} facilities={[]} activeTab={tab} onRefresh={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByText(content)).toBeInTheDocument();
  });
});
