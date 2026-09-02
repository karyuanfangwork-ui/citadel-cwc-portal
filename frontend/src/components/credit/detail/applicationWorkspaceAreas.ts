import {
  ALL_TABS,
  ALL_TABS_360,
  DetailTab,
  DetailTab360,
  TAB_TO_TAB360,
} from '../../../../pages/credit/creditUtils';

export type ApplicationWorkspaceArea =
  | 'overview'
  | 'application-parties'
  | 'financials'
  | 'risk-compliance'
  | 'assessment-recommendation'
  | 'decision-completion'
  | 'documents'
  | 'activity-audit';

export type WorkspaceAreaType = 'primary' | 'utility';

export interface WorkspaceAreaLocalTab {
  id: string;
  label: string;
  /** Renderer tab used by the existing Application 360 switch. */
  tab: DetailTab360;
  /** Existing query value to preserve deep-link behavior for this local destination. */
  urlTab: string;
}

export interface WorkspaceAreaDefinition {
  id: ApplicationWorkspaceArea;
  label: string;
  type: WorkspaceAreaType;
  defaultTab: DetailTab360;
  legacyTabs: string[];
  localTabs: WorkspaceAreaLocalTab[];
}

const local = (id: string, label: string, tab: DetailTab360, urlTab: string = tab): WorkspaceAreaLocalTab => ({
  id,
  label,
  tab,
  urlTab,
});

export const APPLICATION_WORKSPACE_AREAS: WorkspaceAreaDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    type: 'primary',
    defaultTab: 'overview',
    legacyTabs: ['overview'],
    localTabs: [],
  },
  {
    id: 'application-parties',
    label: 'Application & Parties',
    type: 'primary',
    defaultTab: 'application-details',
    legacyTabs: ['application-details', 'loan-request', 'facilities', 'header', 'customer-profile', 'borrower-profile', 'parties'],
    localTabs: [
      local('application', 'Application', 'application-details', 'application-details'),
      local('facilities', 'Facilities', 'application-details', 'facilities'),
      local('borrower', 'Borrower', 'customer-profile', 'customer-profile'),
      local('related-parties', 'Related Parties', 'customer-profile', 'parties'),
    ],
  },
  {
    id: 'financials',
    label: 'Financials',
    type: 'primary',
    defaultTab: 'financial-profile',
    legacyTabs: ['financial-profile', 'financials', 'sme-financials', 'payment-capability'],
    localTabs: [
      local('income', 'Income', 'financial-profile', 'financial-profile'),
      local('statements', 'Statements', 'financial-profile', 'financials'),
      local('spreading', 'Spreading', 'financial-profile', 'sme-financials'),
      local('ratios-trends', 'Ratios & Trends', 'financial-profile', 'ratios-trends'),
      local('repayment-capacity', 'Repayment Capacity', 'financial-profile', 'payment-capability'),
    ],
  },
  {
    id: 'risk-compliance',
    label: 'Risk & Compliance',
    type: 'primary',
    defaultTab: 'risk-assessment',
    legacyTabs: [
      'risk-assessment', 'risk-score', 'risk-rating', 'industry', 'risk', 'profitability',
      'counterparties', 'conduct', 'forward-looking-risk', 'credit-bureau', 'credit-checks-risk',
      'credit-checks', 'collateral-guarantees', 'collateral', 'security', 'guarantor-assessment',
    ],
    localTabs: [
      local('bureau-kyc', 'Bureau & KYC', 'credit-bureau', 'credit-bureau'),
      local('risk-rating', 'Risk Rating', 'risk-assessment', 'risk-score'),
      local('collateral-guarantees', 'Collateral & Guarantees', 'collateral-guarantees', 'collateral'),
      local('compliance', 'Compliance / Exceptions', 'credit-bureau', 'credit-checks-risk'),
    ],
  },
  {
    id: 'assessment-recommendation',
    label: 'Assessment & Recommendation',
    type: 'primary',
    defaultTab: 'approvals',
    legacyTabs: ['ca-memo'],
    localTabs: [
      local('assessment', 'Assessment', 'approvals', 'assessment'),
      local('deviations-mitigants', 'Deviations & Mitigants', 'risk-assessment', 'risk-assessment'),
      // The tab-only legacy URL `approvals` historically opened the analyst recommendation surface.
      local('recommendation', 'Recommendation', 'approvals', 'approvals'),
      local('ca-memo', 'CA Memo', 'ca-memo', 'ca-memo'),
    ],
  },
  {
    id: 'decision-completion',
    label: 'Decision & Completion',
    type: 'primary',
    defaultTab: 'approvals',
    legacyTabs: ['approvals', 'signoff', 'guarantor-assessment', 'conditions', 'summary', 'conditions-offer', 'disbursement'],
    localTabs: [
      local('approvals', 'Approvals', 'approvals', 'approvals'),
      local('decision-history', 'Decision & History', 'timeline-audit', 'audit'),
      local('conditions-offer', 'Conditions & Offer', 'conditions-offer', 'conditions'),
      local('completion', 'Completion', 'disbursement', 'disbursement'),
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    type: 'utility',
    defaultTab: 'documents',
    legacyTabs: ['documents'],
    localTabs: [],
  },
  {
    id: 'activity-audit',
    label: 'Activity & Audit',
    type: 'utility',
    defaultTab: 'timeline-audit',
    legacyTabs: ['comments', 'timeline-audit', 'audit'],
    localTabs: [
      local('activity', 'Activity', 'timeline-audit', 'comments'),
      local('audit', 'Audit', 'timeline-audit', 'audit'),
    ],
  },
];

const AREA_BY_ID = new Map(APPLICATION_WORKSPACE_AREAS.map(area => [area.id, area]));
const TAB_TO_AREA = new Map<string, ApplicationWorkspaceArea>();

for (const area of APPLICATION_WORKSPACE_AREAS) {
  for (const tab of area.legacyTabs) TAB_TO_AREA.set(tab, area.id);
}
for (const area of APPLICATION_WORKSPACE_AREAS) {
  for (const tab of area.localTabs) {
    if (!TAB_TO_AREA.has(tab.tab)) TAB_TO_AREA.set(tab.tab, area.id);
    if (!TAB_TO_AREA.has(tab.urlTab)) TAB_TO_AREA.set(tab.urlTab, area.id);
  }
}
for (const area of APPLICATION_WORKSPACE_AREAS) {
  if (!TAB_TO_AREA.has(area.defaultTab)) TAB_TO_AREA.set(area.defaultTab, area.id);
}

export interface WorkspaceLocation {
  area: ApplicationWorkspaceArea;
  tab: DetailTab360;
  /** Canonical local destination used by workspace wrappers and readiness actions. */
  localTab?: string;
  legacyTab?: string;
}

export type WorkspaceFeatureFlags = Record<string, boolean | undefined>;

/** Resolve both legacy and 360 query values to the parent work area. */
export function resolveWorkspaceAreaFromTab(tab: string | null | undefined): ApplicationWorkspaceArea {
  return resolveWorkspaceLocationFromTab(tab).area;
}

/** Resolve a query value without changing the existing renderer contract. */
export function resolveWorkspaceLocationFromTab(tab: string | null | undefined): WorkspaceLocation {
  const rawTab = tab ?? '';
  const canonicalTab = ALL_TABS_360.includes(rawTab as DetailTab360)
    ? rawTab as DetailTab360
    : TAB_TO_TAB360[rawTab as DetailTab] ?? null;

  if (!canonicalTab) return { area: 'overview', tab: 'overview' };

  const area = TAB_TO_AREA.get(rawTab) ?? TAB_TO_AREA.get(canonicalTab) ?? 'overview';
  const definition = getWorkspaceArea(area);
  const localDestination = definition.localTabs.find(localTab => localTab.id === rawTab || localTab.urlTab === rawTab)
    ?? definition.localTabs.find(localTab => localTab.tab === canonicalTab);
  return {
    area,
    tab: canonicalTab,
    ...(localDestination ? { localTab: localDestination.id } : {}),
    ...(ALL_TABS.includes(rawTab as DetailTab) && !ALL_TABS_360.includes(rawTab as DetailTab360)
      ? { legacyTab: rawTab }
      : {}),
  };
}

/** Resolve a canonical area/local-tab URL while keeping tab-only legacy URLs valid. */
export function resolveWorkspaceLocationFromQuery(
  tab: string | null | undefined,
  area: string | null | undefined,
): WorkspaceLocation {
  const location = resolveWorkspaceLocationFromTab(tab);
  if (!area || !AREA_BY_ID.has(area as ApplicationWorkspaceArea)) return location;

  const selectedArea = area as ApplicationWorkspaceArea;
  const definition = getWorkspaceArea(selectedArea);
  const localDestination = definition.localTabs.find(localTab => localTab.id === tab || localTab.urlTab === tab)
    ?? definition.localTabs.find(localTab => localTab.tab === tab);
  if (!localDestination) return { ...location, area: selectedArea };
  return {
    ...location,
    area: selectedArea,
    tab: localDestination.tab,
    localTab: localDestination.id,
  };
}

export function getWorkspaceArea(areaId: ApplicationWorkspaceArea): WorkspaceAreaDefinition {
  return AREA_BY_ID.get(areaId) ?? APPLICATION_WORKSPACE_AREAS[0];
}

export function getWorkspaceAreaForTab(tab: string | null | undefined): WorkspaceAreaDefinition {
  return getWorkspaceArea(resolveWorkspaceAreaFromTab(tab));
}

export function getVisibleWorkspaceLocalTabs(
  areaId: ApplicationWorkspaceArea,
  borrowerType?: string | null,
  lane?: string | null,
  _featureFlags: WorkspaceFeatureFlags = {},
): WorkspaceAreaLocalTab[] {
  const tabs = getWorkspaceArea(areaId).localTabs;
  if (lane === 'PERSONAL_FAST') {
    if (areaId === 'application-parties') return tabs.filter(tab => tab.id === 'application' || tab.id === 'borrower');
    if (areaId === 'financials') return tabs.filter(tab => tab.id === 'income');
    if (areaId === 'risk-compliance') return tabs.filter(tab => tab.id === 'bureau-kyc');
    if (areaId === 'assessment-recommendation') return tabs.filter(tab => tab.id === 'assessment');
    if (areaId === 'decision-completion') return [];
  }
  if (areaId === 'application-parties') {
    if (borrowerType === 'INDIVIDUAL' || borrowerType === 'JOINT' || lane === 'PERSONAL_FAST') {
      return tabs.filter(tab => tab.id !== 'related-parties');
    }
    return tabs;
  }

  if (areaId === 'financials') {
    if (borrowerType === 'INDIVIDUAL' || borrowerType === 'JOINT' || lane === 'PERSONAL_FAST') {
      return tabs.filter(tab => tab.id === 'income' || tab.id === 'repayment-capacity');
    }
    return tabs.filter(tab => tab.id !== 'income');
  }

  return tabs;
}

/** Primary/utility areas applicable to the lightweight Personal Fast journey. */
export function getVisibleWorkspaceAreas(
  lane?: string | null,
): WorkspaceAreaDefinition[] {
  if (lane !== 'PERSONAL_FAST') return APPLICATION_WORKSPACE_AREAS;
  return APPLICATION_WORKSPACE_AREAS.filter(area => area.id !== 'decision-completion');
}
