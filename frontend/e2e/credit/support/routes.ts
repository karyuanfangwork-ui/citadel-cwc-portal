// frontend/e2e/credit/support/routes.ts

/**
 * Every static credit route, with the content that proves it actually rendered.
 *
 * This exists because LOS-020 shipped a My Approvals page that crashed into its
 * error boundary for every user — including admin — and the spec covering it
 * asserted on a heading the page shell renders *before* the crash. A heading is
 * not evidence. The `expect` pattern below is matched inside <main>, after the
 * error boundary has been ruled out.
 *
 * `permission` documents which route guard applies (see frontend/App.tsx:306-327).
 * All fourteen are reachable by admin@test.local, which holds every credit
 * permission, so the smoke run uses that session. The permission field is here so
 * that a future per-role matrix does not have to rediscover it.
 *
 * When adding a credit route to App.tsx, add it here. That is the whole contract.
 */
export interface CreditRoute {
  path: string;
  name: string;
  permission: string;
  /** Matched against <main> innerText once the page has settled. */
  expect: RegExp;
}

export const CREDIT_ROUTES: CreditRoute[] = [
  { path: '/credit',                  name: 'Dashboard',            permission: 'credit:read',    expect: /Credit Assessment Dashboard/i },
  { path: '/credit/borrowers',        name: 'Borrower list',        permission: 'credit:read',    expect: /Borrower Management/i },
  { path: '/credit/borrowers/new',    name: 'Borrower create',      permission: 'credit:create',  expect: /Duplicate Check/i },
  { path: '/credit/applications',     name: 'Application list',     permission: 'credit:read',    expect: /Application Management/i },
  { path: '/credit/applications/new', name: 'Application create',   permission: 'credit:create',  expect: /New Credit Application Wizard/i },
  { path: '/credit/approvals',        name: 'My Approvals',         permission: 'credit:approve', expect: /My Approvals/i },
  // Context-required empty state: financials hang off a borrower, so with no
  // borrower selected the page correctly renders a prompt and no heading.
  { path: '/credit/financials',       name: 'Financial spreading',  permission: 'credit:read',    expect: /No Borrower Selected/i },
  { path: '/credit/analysis',         name: 'Financial analysis',   permission: 'credit:read',    expect: /Ratio & Trend Analysis/i },
  { path: '/credit/scorecards',       name: 'Scorecard admin',      permission: 'credit:admin',   expect: /Scorecard Management/i },
  { path: '/credit/rating-bands',     name: 'Rating band admin',    permission: 'credit:admin',   expect: /Credit Risk Configuration/i },
  { path: '/credit/committee',        name: 'Committee meetings',   permission: 'credit:read',    expect: /Committee Meetings/i },
  // Context-required empty state, same reasoning as /credit/financials.
  { path: '/credit/collateral',       name: 'Collateral',           permission: 'credit:read',    expect: /No application selected/i },
  { path: '/credit/reports',          name: 'Reports',              permission: 'credit:read',    expect: /Credit Reports/i },
  { path: '/credit/group-exposure',   name: 'Group exposure',       permission: 'credit:read',    expect: /Group Exposure Aggregation/i },
];
