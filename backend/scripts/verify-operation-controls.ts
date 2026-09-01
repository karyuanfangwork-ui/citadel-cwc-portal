/**
 * Operation Control Coverage Verification — P02/P03 Task 10
 *
 * Scans all route files, extracts HTTP method + path for each route declaration,
 * and compares against the operation control registry. Reports uncovered routes
 * and extra registry entries.
 *
 * Run: npx tsx backend/scripts/verify-operation-controls.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { operationControls } from '../src/security/operation-control.registry';

// ── ESM route file → mount prefix map ────────────────────────────────
// Derived from backend/src/routes/index.ts router.use() declarations.
const ESM_MOUNT_PREFIXES: Record<string, string> = {
  'auth.routes': '/auth',
  'user.routes': '/users',
  'request.routes': '/requests',
  'serviceDesk.routes': '/service-desks',
  'notification.routes': '/notifications',
  'notificationSse.routes': '/notifications',
  'kb.routes': '/kb',
  'search.routes': '/search',
  'approval.routes': '/approvals',
  'policyExplainer.routes': '/approvals',
  'interview.routes': '/interviews',
  'screening.routes': '/screening',
  'loa.routes': '/loa',
  'onboarding.routes': '/onboarding',
  'offboarding.routes': '/offboarding',
  'onboardingTemplate.routes': '/admin/onboarding-templates',
  'offboardingTemplate.routes': '/admin/offboarding-templates',
  'it-workflow.routes': '/it-workflow',
  'finance-workflow.routes': '/finance-workflow',
  'chargeback-workflow.routes': '/chargeback-workflow',
  'esm-workflow.routes': '/esm-workflow',
  'workflow.routes': '/admin/workflows',
  'reports.routes': '/reports',
  'bannerConfig.routes': '/admin/banner-configs',
  'requestStatusDefinition.routes': '/admin/status-definitions',
  'workflowTransition.routes': '/admin/workflow-transitions',
  'notificationTemplate.routes': '/admin/notification-templates',
  'systemSetting.routes': '/admin/system-settings',
  'file.routes': '/files',
  'entity.routes': '/admin/entities',
  'escalationRule.routes': '/sla',
  'auditLog.routes': '/admin/audit-logs',
  'asset.routes': '/assets',
  'crm.routes': '/crm',
  'crm-ai.routes': '/crm/ai',
  'announcement.routes': '/announcements',
  'tenant.routes': '/admin/tenants',
  'scheduler.routes': '/admin/scheduler',
  'queue.routes': '/admin/queues',
  'insights.routes': '/insights',
  'pdfJob.routes': '/pdf-jobs',
  'catalogEntitlement.routes': '/admin/catalog-entitlements',
  'approvalPolicy.routes': '/admin/approval-policies',
  'approvalDelegation.routes': '/approval-delegations',
  'department.routes': '/departments',
  // Nested under /requests/:id/participants — routes use mergeParams
  'participant.routes': '/requests/:id/participants',
};

// Files that are not standalone route files
const ESM_SKIP_FILES = new Set(['index', 'resume.controller']);

// ── Credit sub-router mount prefixes ─────────────────────────────────
// Derived from backend/src/credit/routes/credit.routes.ts router.use() declarations.
// Parent prefix is '/credit'; sub-mounts are appended.
const CREDIT_SUB_MOUNTS: Record<string, string> = {
  'borrowerProfile.routes': '/borrowers',
  'borrowerDuplicateException.routes': '/borrowers/duplicate-exceptions',
  'director.routes': '/borrowers',
  'fatcaCrs.routes': '/borrowers',
  'shareholder.routes': '/borrowers',
  'ubo.routes': '/borrowers',
  'relatedPartyGroup.routes': '/related-party-groups',
  'branch.routes': '/branches',
  'creditDocument.routes': '',          // router.use(creditDocumentRoutes) — no path prefix
  'application.routes': '/applications',
  'applicationFacility.routes': '/applications',
  'applicationParty.routes': '/applications',
  'requestItem.routes': '/applications',
  'exposureSummary.routes': '/applications',
  'externalRating.routes': '/applications',
  'ecl.routes': '/applications',
  'projection.routes': '/applications',
  'sensitivityScenario.routes': '/applications',
  'approval.routes': '',               // router.use(approvalRoutes) — no path prefix
  'webhook.routes': '/webhooks',
  'financial.routes': '/borrowers',
  'financials.routes': '/financials',
  'scorecard.routes': '/scorecards',
  'scorecardVersion.routes': '/scorecard-versions',
  'scoring.routes': '/applications',
  'scoreRun.routes': '/score-runs',
  'committee.routes': '/committee',
  'collateral.routes': '/applications',
  'collateralItem.routes': '/collateral',
  'guarantee.routes': '/applications',
  'condition.routes': '/applications',
  'conditionItem.routes': '/conditions',
  'dashboard.routes': '/dashboard',
  'reports.routes': '/reports',
  'monitoring.routes': '/applications',
  'monitoringItem.routes': '',          // router.use(monitoringItemRoutes) — no path prefix
  'security.routes': '/security',
  'creditRecommendation.routes': '',    // router.use(creditRecommendationRoutes) — no path prefix
  'borrowerRisk.routes': '',           // router.use(borrowerRiskRoutes) — no path prefix
  'bureauCheck.routes': '/applications',
  'qualitativeAssessment.routes': '/applications',
  'retailIncome.routes': '/applications',
  'bureauChecklist.routes': '/applications',
  'industryAssessment.routes': '/applications',
  'riskAssessment.routes': '/applications',
  'assessmentResult.routes': '/applications',
  'ratingBandConfig.routes': '/rating-bands',
  'rmdIssue.routes': '/applications',
  'esg.routes': '/applications',
  'sicr.routes': '/applications',
  'signoff.routes': '/applications',
  'profitability.routes': '/applications',
  'walletShare.routes': '/applications',
  'keyCounterparty.routes': '',       // router.use(keyCounterpartyRoutes) — no path prefix
  'accountUtilisation.routes': '/applications',
  'scoreOverride.routes': '/score-overrides',
  'delegation.routes': '/delegation',
  'creditSla.routes': '/sla',
  'dlp.routes': '',                    // router.use('/', dlpRoutes)
  'disbursement.routes': '/applications',
  'pricing.routes': '/applications',
  'loo.routes': '/applications',
  'rejection.routes': '/applications',
  'applicationSnapshot.routes': '/applications',
  'policyResult.routes': '/applications',
  'amlRescreen.routes': '',            // router.use('/', amlRescreenRoutes)
  'policyLimit.routes': '/policy-limits',
  'creditRuleConfig.routes': '',       // router.use('/', creditRuleConfigRoutes)
  'fxRate.routes': '/fx-rates',
  'creditAi.routes': '/applications',  // router.use('/applications', creditAiRoutes)
  'deviation.routes': '/deviations',
  'consent.routes': '/consent',
  'str.routes': '/str',
  'mfa.routes': '/mfa',
  'smeFinancial.routes': '/sme',
  'comment.routes': '',                // router.use('/', commentRoutes)
  'credit.routes': '',                // Top-level router itself (has its own routes)
};

const ROUTES_DIR = path.resolve(__dirname, '..', 'src', 'routes');
const CREDIT_ROUTES_DIR = path.resolve(__dirname, '..', 'src', 'credit', 'routes');

export interface RouteOp {
  method: string;
  path: string;
  file: string;
}

/**
 * Extract route declarations from file content.
 * Handles both single-line and multi-line route definitions.
 */
function extractRoutesFromContent(content: string, mountPrefix: string, fileName: string): RouteOp[] {
  const routes: RouteOp[] = [];
  const seen = new Set<string>();

  // Use the TypeScript AST rather than regular expressions so commented-out
  // declarations (for example the disabled auth registration route) cannot be
  // counted as live operations. This also handles single- and multi-line calls
  // through the same code path.
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const supportedMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === 'router'
      && supportedMethods.has(node.expression.name.text)
    ) {
      const firstArgument = node.arguments[0];
      if (firstArgument && (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument))) {
        const method = node.expression.name.text.toUpperCase();
        const routePath = firstArgument.text;
        const fullPath = mountPrefix + (routePath.startsWith('/') ? routePath : `/${routePath}`);
        const key = `${method} ${fullPath}`;
        if (!seen.has(key)) {
          seen.add(key);
          routes.push({ method, path: fullPath, file: fileName });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return routes;
}

/**
 * Scan a directory for route files and extract route declarations.
 * For ESM routes, prefixMap contains full mount paths (e.g., '/admin/banner-configs').
 * For credit sub-routes, prefixMap contains sub-mounts to compose with parentPrefix.
 */
function extractRoutesFromDir(
  dir: string,
  prefixMap: Record<string, string>,
  parentPrefix: string,
  skipFiles?: Set<string>,
): RouteOp[] {
  const routes: RouteOp[] = [];
  if (!fs.existsSync(dir)) return routes;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'));

  for (const file of files) {
    const baseName = file.replace(/\.(ts|js)$/, '');
    if (skipFiles?.has(baseName)) continue;

    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const subMount = prefixMap[baseName];
    // Compose mount prefix: parentPrefix + subMount (for credit routes),
    // or use the full path from the map (for ESM routes where parentPrefix is '').
    const mountPrefix = subMount !== undefined
      ? (parentPrefix + subMount)
      : parentPrefix;

    const fileRoutes = extractRoutesFromContent(content, mountPrefix, baseName);
    routes.push(...fileRoutes);
  }

  return routes;
}

export function extractAllRoutes(): RouteOp[] {
  const esmRoutes = extractRoutesFromDir(ROUTES_DIR, ESM_MOUNT_PREFIXES, '', ESM_SKIP_FILES);
  const creditRoutes = extractRoutesFromDir(CREDIT_ROUTES_DIR, CREDIT_SUB_MOUNTS, '/credit');
  return [...esmRoutes, ...creditRoutes];
}

/** Normalize a route path for comparison — remove /api/v1 prefix, trailing slashes. */
export function normalizePath(p: string): string {
  let normalized = p.replace(/^\/api\/v1/, '');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

function main() {
  const allRoutes = extractAllRoutes();
  console.log(`\n=== Operation Control Coverage Report ===\n`);
  console.log(`Total route declarations found: ${allRoutes.length}`);

  // Deduplicate by method+normalized path
  const routeMap = new Map<string, RouteOp[]>();
  for (const r of allRoutes) {
    const key = `${r.method} ${normalizePath(r.path)}`;
    if (!routeMap.has(key)) routeMap.set(key, []);
    routeMap.get(key)!.push(r);
  }

  console.log(`Unique method+path combinations: ${routeMap.size}`);

  // Build the registry map from the executable typed source of truth. Parsing
  // source text silently misses imported/spread batches and masks duplicate
  // keys when a Map is populated too early.
  const normalizedRegistry = new Map<string, string>();
  const duplicateRegistryKeys: string[] = [];
  for (const control of operationControls) {
    const normalizedKey = `${control.method} ${normalizePath(control.path)}`;
    if (normalizedRegistry.has(normalizedKey)) {
      duplicateRegistryKeys.push(normalizedKey);
    }
    normalizedRegistry.set(normalizedKey, control.owner);
  }
  console.log(`\nRegistered operation controls: ${operationControls.length}`);

  // Find uncovered routes (in code but not in registry)
  const uncovered: string[] = [];
  for (const [key] of routeMap) {
    if (!normalizedRegistry.has(key)) {
      uncovered.push(key);
    }
  }

  // Find extra registered routes (in registry but not in code)
  const extra: string[] = [];
  for (const [key] of normalizedRegistry) {
    if (!routeMap.has(key)) {
      extra.push(key);
    }
  }

  if (uncovered.length > 0) {
    console.log(`\n--- Uncovered routes (${uncovered.length}) ---`);
    uncovered.sort().forEach(r => console.log(`  ${r}`));
  }

  if (extra.length > 0) {
    console.log(`\n--- Extra registry entries not in routes (${extra.length}) ---`);
    extra.sort().forEach(r => console.log(`  ${r}`));
  }

  if (duplicateRegistryKeys.length > 0) {
    console.log(`\n--- Duplicate registry entries (${duplicateRegistryKeys.length}) ---`);
    duplicateRegistryKeys.sort().forEach(r => console.log(`  ${r}`));
  }

  const coveredRouteCount = routeMap.size - uncovered.length;
  const coveragePercent = routeMap.size > 0
    ? (coveredRouteCount / routeMap.size * 100).toFixed(1)
    : '0';

  const coveredRegistryCount = normalizedRegistry.size - extra.length;
  const registryPercent = normalizedRegistry.size > 0
    ? (coveredRegistryCount / normalizedRegistry.size * 100).toFixed(1)
    : '0';

  console.log(`\n--- Route → Registry Coverage: ${coveredRouteCount}/${routeMap.size} (${coveragePercent}%) ---`);
  console.log(`--- Registry → Route Coverage: ${coveredRegistryCount}/${normalizedRegistry.size} (${registryPercent}%) ---`);
  console.log(`--- Total registered controls: ${operationControls.length} ---\n`);

  if (uncovered.length > 0 || extra.length > 0 || duplicateRegistryKeys.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}