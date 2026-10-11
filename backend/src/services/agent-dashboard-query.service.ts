import { Prisma } from '@prisma/client';
import { CLOSED_STATUSES, RESOLVED_STATUSES } from '../constants/requestStatuses';
import { PolicyPrincipal } from '../security/policy.types';
import type { DashboardQuery, DashboardScope } from './agent-dashboard.service';

const CLOSED = CLOSED_STATUSES.map(String);
const POSITIVE = RESOLVED_STATUSES.map(String);
const EXECUTIVE_ROLES = new Set(['CEO', 'CTO', 'CFO', 'GROUP_DCEO']);

function anyStatus(column: Prisma.Sql, statuses: string[]): Prisma.Sql {
  return Prisma.sql`${column} = ANY(ARRAY[${Prisma.join(statuses)}]::text[])`;
}

function existsParticipant(userId: string): Prisma.Sql {
  return Prisma.sql`EXISTS (SELECT 1 FROM request_participants p WHERE p.request_id = r.id AND p.user_id = ${userId}::uuid)`;
}

function existsApprover(userId: string): Prisma.Sql {
  return Prisma.sql`EXISTS (SELECT 1 FROM request_approvals a WHERE a.request_id = r.id AND a.approver_id = ${userId}::uuid)`;
}

function visibilityWhere(principal: PolicyPrincipal, scope: DashboardQuery['scope']): Prisma.Sql[] {
  const where: Prisma.Sql[] = [Prisma.sql`r.deleted_at IS NULL`];
  if (principal.tenantId) where.push(Prisma.sql`r.tenant_id = ${principal.tenantId}::uuid`);

  if (!principal.roles.includes('ADMIN')) {
    const visible: Prisma.Sql[] = [
      Prisma.sql`r.requester_id = ${principal.userId}::uuid`,
      Prisma.sql`r.assigned_to_id = ${principal.userId}::uuid`,
      existsParticipant(principal.userId),
    ];
    if (principal.agentTeam) {
      const team = principal.agentTeam.trim().toUpperCase();
      visible.push(Prisma.sql`r.assigned_team = ${team}`);
      visible.push(Prisma.sql`EXISTS (SELECT 1 FROM service_desks sd WHERE sd.id = r.service_desk_id AND sd.code = ${team})`);
    }
    if (principal.roles.some((role) => EXECUTIVE_ROLES.has(role))) visible.push(existsApprover(principal.userId));
    where.push(Prisma.sql`(${Prisma.join(visible, ' OR ')})`);

    if (!principal.permissions.includes('request:confidential')) {
      where.push(Prisma.sql`(r.is_confidential = false OR r.requester_id = ${principal.userId}::uuid OR r.assigned_to_id = ${principal.userId}::uuid OR ${existsApprover(principal.userId)} OR ${existsParticipant(principal.userId)})`);
    }
  }

  if (scope === 'mine') {
    where.push(Prisma.sql`r.assigned_to_id = ${principal.userId}::uuid`);
  } else if (scope === 'team') {
    if (!principal.roles.includes('AGENT') || !principal.agentTeam) throw new Error('My team scope is unavailable');
    const team = principal.agentTeam.trim().toUpperCase();
    where.push(Prisma.sql`(r.assigned_to_id = ${principal.userId}::uuid OR r.assigned_team = ${team} OR EXISTS (SELECT 1 FROM service_desks sd WHERE sd.id = r.service_desk_id AND sd.code = ${team}))`);
  } else if (!principal.roles.includes('ADMIN')) {
    throw new Error('Dashboard scope is not allowed');
  }

  return where;
}

function queryFilters(query: DashboardQuery): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (query.requestTypeId) where.push(Prisma.sql`r.request_type_id = ${query.requestTypeId}::uuid`);
  if (query.priority) where.push(Prisma.sql`r.priority::text = ${query.priority}`);
  if (query.queue === 'open') where.push(Prisma.sql`NOT (${anyStatus(Prisma.sql`r.status`, CLOSED)})`);
  if (query.queue === 'closed') where.push(anyStatus(Prisma.sql`r.status`, CLOSED));
  if (query.queue === 'unassigned') {
    where.push(Prisma.sql`NOT (${anyStatus(Prisma.sql`r.status`, CLOSED)})`);
    where.push(Prisma.sql`r.assigned_to_id IS NULL`);
  }
  if (query.search) {
    const nameParts = query.search.trim().split(/\s+/);
    const fullName = nameParts.length > 1
      ? Prisma.sql`OR (position(lower(${query.search}) in lower(concat_ws(' ', requester.first_name, requester.last_name))) > 0)`
      : Prisma.empty;
    where.push(Prisma.sql`(
      position(lower(${query.search}) in lower(r.reference_number)) > 0 OR
      position(lower(${query.search}) in lower(r.summary)) > 0 OR
      position(lower(${query.search}) in lower(requester.first_name)) > 0 OR
      position(lower(${query.search}) in lower(requester.last_name)) > 0 OR
      position(lower(${query.search}) in lower(request_type.name)) > 0
      ${fullName}
    )`);
  }
  return where;
}

export function dashboardSlaStateExpression(now: Date): Prisma.Sql {
  const closed = Prisma.sql`ARRAY[${Prisma.join(CLOSED)}]::text[]`;
  const positive = Prisma.sql`ARRAY[${Prisma.join(POSITIVE)}]::text[]`;
  return Prisma.sql`CASE
    WHEN r.status = ANY(${closed}) AND NOT (r.status = ANY(${positive})) THEN 'NOT_APPLICABLE'
    WHEN r.status = ANY(${positive}) THEN CASE
      WHEN clocks.current_count > 0 OR clocks.completed_count <> 1 OR clocks.completed_at IS NULL THEN 'UNKNOWN'
      WHEN clocks.completed_at <= clocks.completed_due_at THEN 'MET'
      ELSE 'MISSED'
    END
    WHEN clocks.current_count > 1 THEN 'UNKNOWN'
    WHEN clocks.current_count = 1 THEN CASE
      WHEN clocks.current_due_at IS NULL THEN 'UNKNOWN'
      WHEN clocks.current_status = 'PAUSED' THEN CASE WHEN clocks.current_paused_at IS NULL THEN 'UNKNOWN' ELSE 'PAUSED' END
      WHEN clocks.current_status IN ('ACTIVE', 'BREACHED') THEN CASE
        WHEN clocks.current_paused_at IS NOT NULL OR (clocks.current_status = 'BREACHED' AND clocks.current_due_at > ${now}) OR r.sla_paused_at IS NOT NULL THEN 'UNKNOWN'
        WHEN clocks.current_due_at <= ${now} THEN 'BREACHED'
        WHEN clocks.current_due_at <= ${new Date(now.getTime() + 86_400_000)} THEN 'DUE_SOON'
        ELSE 'ON_TRACK'
      END
      ELSE 'UNKNOWN'
    END
    WHEN r.sla_due_at IS NULL THEN 'NO_SLA'
    WHEN r.sla_paused_at IS NOT NULL THEN 'PAUSED'
    WHEN r.sla_due_at <= ${now} THEN 'BREACHED'
    WHEN r.sla_due_at <= ${new Date(now.getTime() + 86_400_000)} THEN 'DUE_SOON'
    ELSE 'ON_TRACK'
  END`;
}

function requestSlaFromSql(): Prisma.Sql {
  return Prisma.sql`FROM requests r
    LEFT JOIN users requester ON requester.id = r.requester_id
    LEFT JOIN request_types request_type ON request_type.id = r.request_type_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE c.status::text IN ('ACTIVE', 'PAUSED', 'BREACHED'))::int AS current_count,
        count(*) FILTER (WHERE c.status::text = 'COMPLETED')::int AS completed_count,
        (array_agg(c.status::text ORDER BY c.updated_at DESC) FILTER (WHERE c.status::text IN ('ACTIVE', 'PAUSED', 'BREACHED')))[1] AS current_status,
        max(c.due_at) FILTER (WHERE c.status::text IN ('ACTIVE', 'PAUSED', 'BREACHED')) AS current_due_at,
        max(c.paused_at) FILTER (WHERE c.status::text IN ('ACTIVE', 'PAUSED', 'BREACHED')) AS current_paused_at,
        max(c.due_at) FILTER (WHERE c.status::text = 'COMPLETED') AS completed_due_at,
        max(c.completed_at) FILTER (WHERE c.status::text = 'COMPLETED') AS completed_at
      FROM sla_clocks c
      WHERE c.request_id = r.id AND c.kind::text = 'RESOLUTION' AND c.status::text IN ('ACTIVE', 'PAUSED', 'BREACHED', 'COMPLETED')
    ) clocks ON TRUE`;
}

function baseScopeWhere(principal: PolicyPrincipal, scope: DashboardScope, requestTypeId?: string): Prisma.Sql[] {
  const where = visibilityWhere(principal, scope);
  if (requestTypeId) where.push(Prisma.sql`r.request_type_id = ${requestTypeId}::uuid`);
  return where;
}

export function buildDashboardSlaMetricsQuery(
  principal: PolicyPrincipal,
  scope: DashboardScope,
  requestTypeId: string | undefined,
  now: Date,
): Prisma.Sql {
  const where = [...baseScopeWhere(principal, scope, requestTypeId), Prisma.sql`NOT (${anyStatus(Prisma.sql`r.status`, CLOSED)})`];
  const state = dashboardSlaStateExpression(now);
  return Prisma.sql`SELECT
    count(*) FILTER (WHERE (${state}) = 'DUE_SOON')::int AS due_soon,
    count(*) FILTER (WHERE (${state}) = 'BREACHED')::int AS breached
    ${requestSlaFromSql()}
    WHERE ${Prisma.join(where, ' AND ')}`;
}

export function buildDashboardAttentionQuery(
  principal: PolicyPrincipal,
  scope: DashboardScope,
  requestTypeId: string | undefined,
  now: Date,
): Prisma.Sql {
  const where = [...baseScopeWhere(principal, scope, requestTypeId), Prisma.sql`NOT (${anyStatus(Prisma.sql`r.status`, CLOSED)})`];
  const state = dashboardSlaStateExpression(now);
  where.push(Prisma.sql`((${state}) IN ('BREACHED', 'DUE_SOON') OR r.priority::text IN ('CRITICAL', 'HIGH'))`);
  return Prisma.sql`WITH attention AS (
    SELECT r.id, r.created_at, r.priority, (${state}) AS sla_state,
      COALESCE(clocks.current_due_at, r.sla_due_at) AS due_at
      ${requestSlaFromSql()}
      WHERE ${Prisma.join(where, ' AND ')}
  )
  SELECT count(*)::int AS total,
    COALESCE(ARRAY(
      SELECT id FROM attention
      ORDER BY CASE sla_state WHEN 'BREACHED' THEN 0 WHEN 'DUE_SOON' THEN 1 ELSE 2 END,
        CASE WHEN sla_state IN ('BREACHED', 'DUE_SOON') THEN due_at END ASC NULLS LAST,
        CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        created_at ASC, id ASC
      LIMIT 3
    ), ARRAY[]::uuid[]) AS ids
  FROM attention`;
}

export function buildDashboardSlaPageQuery(
  principal: PolicyPrincipal,
  query: DashboardQuery,
  now: Date,
): Prisma.Sql {
  const where = [...visibilityWhere(principal, query.scope), ...queryFilters(query)];
  const state = dashboardSlaStateExpression(now);
  if (query.slaState) where.push(Prisma.sql`(${state}) = ${query.slaState}`);
  let orderBy: Prisma.Sql;
  if (query.queue === 'closed' && query.sort === 'urgency') {
    orderBy = Prisma.sql`m.updated_at DESC, m.id ASC`;
  } else if (query.sort === 'created-asc') {
    orderBy = Prisma.sql`m.created_at ASC, m.id ASC`;
  } else if (query.sort === 'created-desc') {
    orderBy = Prisma.sql`m.created_at DESC, m.id ASC`;
  } else if (query.sort === 'updated-desc') {
    orderBy = Prisma.sql`m.updated_at DESC, m.id ASC`;
  } else {
    orderBy = Prisma.sql`
      CASE WHEN m.is_terminal THEN 1 ELSE 0 END ASC,
      CASE m.sla_state WHEN 'BREACHED' THEN 0 WHEN 'DUE_SOON' THEN 1 WHEN 'ON_TRACK' THEN 2 WHEN 'PAUSED' THEN 3 WHEN 'NO_SLA' THEN 4 WHEN 'UNKNOWN' THEN 5 WHEN 'NOT_APPLICABLE' THEN 6 WHEN 'MET' THEN 7 ELSE 8 END ASC,
      m.due_at ASC NULLS LAST,
      CASE m.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC,
      m.created_at ASC, m.id ASC`;
  }

  return Prisma.sql`WITH matched AS (
    SELECT r.id, r.status, r.created_at, r.updated_at, r.priority,
      r.status = ANY(ARRAY[${Prisma.join(CLOSED)}]::text[]) AS is_terminal,
      COALESCE(clocks.current_due_at, clocks.completed_due_at, r.sla_due_at) AS due_at,
      (${state}) AS sla_state
    ${requestSlaFromSql()}
    WHERE ${Prisma.join(where, ' AND ')}
  ), matching_state AS (
    SELECT * FROM matched ${query.slaState ? Prisma.sql`WHERE sla_state = ${query.slaState}` : Prisma.empty}
  ), page AS (
    SELECT m.id, row_number() OVER (ORDER BY ${orderBy}) AS position
    FROM matching_state m
    ORDER BY ${orderBy}
    LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
  )
  SELECT
    (SELECT count(*)::int FROM matching_state) AS total,
    COALESCE(ARRAY(SELECT id FROM page ORDER BY position), ARRAY[]::uuid[]) AS ids`;
}
