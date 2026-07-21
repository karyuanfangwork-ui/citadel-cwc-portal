/**
 * Operation Control Coverage Verification — P02/P03 Task 10
 *
 * This script scans all route files, extracts the HTTP method + path for each
 * route declaration, and compares the result against the operation control
 * registry. It reports uncovered routes and duplicate entries.
 *
 * Run: npx ts-node backend/scripts/verify-operation-controls.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Mount prefixes from routes/index.ts
const MOUNT_PREFIXES: Record<string, string> = {
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
  'bannerConfig.routes': '/banner-config',
  'requestStatusDefinition.routes': '/request-status-definitions',
  'workflowTransition.routes': '/workflow-transitions',
  'notificationTemplate.routes': '/notification-templates',
  'file.routes': '/files',
  'entity.routes': '/entities',
  'escalationRule.routes': '/escalation-rules',
  'auditLog.routes': '/audit-logs',
  'asset.routes': '/assets',
  'systemSetting.routes': '/system-settings',
  'crm.routes': '/crm',
  'announcement.routes': '/announcements',
  'tenant.routes': '/tenants',
  'scheduler.routes': '/schedulers',
  'queue.routes': '/queues',
  'insights.routes': '/insights',
  'pdfJob.routes': '/pdf-jobs',
  'catalogEntitlement.routes': '/catalog-entitlements',
  'approvalPolicy.routes': '/approval-policies',
  'approvalDelegation.routes': '/approval-delegations',
  'department.routes': '/departments',
  'credit.routes': '/credit',
  'participant.routes': '', // Mounted under /requests/:id/participants
  'resume.controller': '',  // Not a route file
};

const ROUTES_DIR = path.resolve(__dirname, '..', 'src', 'routes');
const CREDIT_ROUTES_DIR = path.resolve(__dirname, '..', 'src', 'credit', 'routes');

interface RouteOp {
  method: string;
  path: string;
  file: string;
}

function extractRoutesFromDir(dir: string, prefix: string): RouteOp[] {
  const routes: RouteOp[] = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const baseName = file.replace(/\.(ts|js)$/, '');
    const mountPrefix = MOUNT_PREFIXES[baseName] || prefix;

    // Match router.get('/path', ...), router.post('/path', ...), etc.
    const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const fullPath = mountPrefix + (routePath.startsWith('/') ? routePath : '/' + routePath);
      routes.push({ method, path: fullPath, file: baseName });
    }

    // Match router.use('/mount', subRouter) — for nested mounts
    const useRegex = /router\.use\s*\(\s*['"`]([^'"`\s]+)/g;
    // We skip sub-router extraction for now — sub-routes are covered by scanning each file
  }

  return routes;
}

function extractAllRoutes(): RouteOp[] {
  const esmRoutes = extractRoutesFromDir(ROUTES_DIR, '/api/v1');
  let creditRoutes: RouteOp[] = [];
  if (fs.existsSync(CREDIT_ROUTES_DIR)) {
    creditRoutes = extractRoutesFromDir(CREDIT_ROUTES_DIR, '/api/v1/credit');
  }
  return [...esmRoutes, ...creditRoutes];
}

function main() {
  const allRoutes = extractAllRoutes();
  console.log(`\n=== Operation Control Coverage Report ===\n`);
  console.log(`Total route operations found: ${allRoutes.length}`);

  // Deduplicate by method+path
  const routeMap = new Map<string, RouteOp[]>();
  for (const r of allRoutes) {
    const key = `${r.method} ${r.path}`;
    if (!routeMap.has(key)) routeMap.set(key, []);
    routeMap.get(key)!.push(r);
  }

  console.log(`Unique method+path combinations: ${routeMap.size}`);

  // Load the registry
  const registryPath = path.resolve(__dirname, '..', 'src', 'security', 'operation-control.registry.ts');
  const registryContent = fs.readFileSync(registryPath, 'utf-8');

  // Extract registered paths from the registry
  const registeredPaths = new Map<string, string>();
  const pathRegex = /path:\s*['"`]([^'"`]+)['"`]/g;
  const methodRegex = /method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/g;

  // Parse the registry entries
  const entries = registryContent.split(/\{[^{}]*method/g).slice(1);
  for (const entry of entries) {
    const methodMatch = /method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/.exec(entry);
    const pathMatch = /path:\s*['"`]([^'"`]+)['"`]/.exec(entry);
    if (methodMatch && pathMatch) {
      const key = `${methodMatch[1]} /api/v1${pathMatch[1]}`;
      registeredPaths.set(key, entry.substring(0, 40));
    }
  }

  console.log(`\nRegistered operation controls: ${registeredPaths.size}`);

  // Find uncovered routes
  const uncovered: string[] = [];
  for (const [key] of routeMap) {
    if (!registeredPaths.has(key)) {
      uncovered.push(key);
    }
  }

  // Find extra registered routes not in actual code
  const extra: string[] = [];
  for (const [key] of registeredPaths) {
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

  const coveragePercent = routeMap.size > 0
    ? ((routeMap.size - uncovered.length) / routeMap.size * 100).toFixed(1)
    : '0';

  console.log(`\n--- Coverage: ${routeMap.size - uncovered.length}/${routeMap.size} (${coveragePercent}%) ---\n`);

  if (uncovered.length > 0) {
    process.exit(1);
  }
}

main();