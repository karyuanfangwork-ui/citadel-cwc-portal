import { Queue, JobsOptions } from 'bullmq';
import { RequestPriority } from '@prisma/client';

import prisma from '../utils/prisma';
import { getRedisConnectionConfig } from '../utils/redis';
import { logger } from '../utils/logger';

const db = prisma as any;

export const SLA_TIMER_QUEUE_NAME = process.env.SLA_TIMER_QUEUE_NAME || 'sla-timers';

export type SlaClockKindValue = 'RESPONSE' | 'RESOLUTION' | 'OLA';
export type SlaTimerJobKindValue = 'SLA_RESPONSE_DUE' | 'SLA_RESOLUTION_DUE' | 'SLA_ESCALATION_DUE';

export interface SlaCalendar {
  timezone?: string;
  businessHours?: { start: string; end: string };
  workdays?: number[]; // 1=Monday ... 7=Sunday
  holidays?: string[]; // YYYY-MM-DD in calendar timezone
}

export interface CreateSlaPolicyVersionInput {
  tenantId: string;
  requestTypeId?: string | null;
  version: number;
  timezone?: string;
  calendar?: SlaCalendar;
  priority?: RequestPriority;
  responseTargetMinutes?: number | null;
  resolutionTargetMinutes?: number | null;
  olaTargetMinutes?: number | null;
}

export interface StartSlaClockInput {
  tenantId: string;
  departmentId?: string | null;
  requestId: string;
  policyVersionId?: string | null;
  kind: SlaClockKindValue;
  dueAt: Date;
  idempotencyKey?: string;
}

export interface ScheduleSlaTimerInput {
  tenantId: string;
  departmentId?: string | null;
  requestId: string;
  clockId: string;
  kind: SlaTimerJobKindValue;
  runAt: Date;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

let queue: Queue | null = null;

function queueEnabled(): boolean {
  return process.env.SLA_TIMER_QUEUE_ENABLED !== 'false';
}

export function getSlaTimerQueue(): Queue {
  if (!queue) {
    queue = new Queue(SLA_TIMER_QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: false,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    });
  }
  return queue;
}

export async function closeSlaTimerQueue(): Promise<void> {
  if (!queue) return;
  await queue.close();
  queue = null;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  return { hour, minute };
}

function malaysiaLocal(date: Date): Date {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

function fromMalaysiaLocal(local: Date): Date {
  return new Date(local.getTime() - 8 * 60 * 60 * 1000);
}

function yyyyMmDd(local: Date): string {
  return local.toISOString().slice(0, 10);
}

function weekday(local: Date): number {
  const day = local.getUTCDay();
  return day === 0 ? 7 : day;
}

function setLocalTime(local: Date, hour: number, minute: number): Date {
  const next = new Date(local);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

function nextBusinessStart(local: Date, calendar: Required<SlaCalendar>): Date {
  const start = parseTime(calendar.businessHours.start);
  let cursor = new Date(local);
  cursor.setUTCHours(start.hour, start.minute, 0, 0);
  while (!calendar.workdays.includes(weekday(cursor)) || calendar.holidays.includes(yyyyMmDd(cursor))) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    cursor.setUTCHours(start.hour, start.minute, 0, 0);
  }
  return cursor;
}

export function normalizeCalendar(calendar: SlaCalendar = {}): Required<SlaCalendar> {
  return {
    timezone: calendar.timezone || 'Asia/Kuala_Lumpur',
    businessHours: calendar.businessHours || { start: '09:00', end: '18:00' },
    workdays: calendar.workdays || [1, 2, 3, 4, 5],
    holidays: calendar.holidays || [],
  };
}

export function addBusinessMinutes(startAt: Date, minutes: number, calendarInput: SlaCalendar = {}): Date {
  const calendar = normalizeCalendar(calendarInput);
  if (calendar.timezone !== 'Asia/Kuala_Lumpur') {
    throw new Error(`Unsupported SLA calendar timezone: ${calendar.timezone}`);
  }

  const start = parseTime(calendar.businessHours.start);
  const end = parseTime(calendar.businessHours.end);
  let remaining = minutes;
  let cursor = malaysiaLocal(startAt);

  while (remaining > 0) {
    if (!calendar.workdays.includes(weekday(cursor)) || calendar.holidays.includes(yyyyMmDd(cursor))) {
      cursor = nextBusinessStart(new Date(cursor.getTime() + 24 * 60 * 60 * 1000), calendar);
      continue;
    }

    const dayStart = setLocalTime(cursor, start.hour, start.minute);
    const dayEnd = setLocalTime(cursor, end.hour, end.minute);
    if (cursor < dayStart) cursor = dayStart;
    if (cursor >= dayEnd) {
      cursor = nextBusinessStart(new Date(cursor.getTime() + 24 * 60 * 60 * 1000), calendar);
      continue;
    }

    const availableMinutes = Math.floor((dayEnd.getTime() - cursor.getTime()) / 60_000);
    const used = Math.min(availableMinutes, remaining);
    cursor = new Date(cursor.getTime() + used * 60_000);
    remaining -= used;
  }

  return fromMalaysiaLocal(cursor);
}

export async function createSlaPolicyVersion(input: CreateSlaPolicyVersionInput) {
  const calendar = normalizeCalendar(input.calendar);
  return db.slaPolicyVersion.create({
    data: {
      tenantId: input.tenantId,
      requestTypeId: input.requestTypeId ?? null,
      version: input.version,
      timezone: input.timezone || calendar.timezone,
      calendar,
      priority: input.priority || RequestPriority.MEDIUM,
      responseTargetMinutes: input.responseTargetMinutes ?? null,
      resolutionTargetMinutes: input.resolutionTargetMinutes ?? null,
      olaTargetMinutes: input.olaTargetMinutes ?? null,
    },
  });
}

export async function startSlaClock(input: StartSlaClockInput) {
  const idempotencyKey = input.idempotencyKey || `${input.requestId}:${input.kind}`;
  return db.slaClock.upsert({
    where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey } },
    update: {},
    create: {
      tenantId: input.tenantId,
      departmentId: input.departmentId ?? null,
      requestId: input.requestId,
      policyVersionId: input.policyVersionId ?? null,
      kind: input.kind,
      dueAt: input.dueAt,
      idempotencyKey,
    },
  });
}

export async function pauseSlaClock(clockId: string, reason = 'workflow_pause', pausedAt = new Date()) {
  const clock = await db.slaClock.findUnique({ where: { id: clockId } });
  if (!clock || clock.status === 'PAUSED') return clock;

  return prisma.$transaction(async (tx) => {
    const runtimeTx = tx as any;
    await runtimeTx.slaPauseLedger.create({
      data: { tenantId: clock.tenantId, clockId, pausedAt, reason },
    });
    return runtimeTx.slaClock.update({
      where: { id: clockId },
      data: { status: 'PAUSED', pausedAt },
    });
  });
}

export async function resumeSlaClock(clockId: string, resumedAt = new Date()) {
  const clock = await db.slaClock.findUnique({ where: { id: clockId } });
  if (!clock || clock.status !== 'PAUSED' || !clock.pausedAt) return clock;

  const durationMs = BigInt(resumedAt.getTime() - clock.pausedAt.getTime());
  return prisma.$transaction(async (tx) => {
    const runtimeTx = tx as any;
    await runtimeTx.slaPauseLedger.updateMany({
      where: { clockId, resumedAt: null },
      data: { resumedAt, durationMs },
    });
    return runtimeTx.slaClock.update({
      where: { id: clockId },
      data: {
        status: 'ACTIVE',
        pausedAt: null,
        pauseDurationMs: { increment: durationMs },
        dueAt: new Date(clock.dueAt.getTime() + Number(durationMs)),
      },
    });
  });
}

export async function scheduleSlaTimer(input: ScheduleSlaTimerInput) {
  const timerJob = await db.slaTimerJob.upsert({
    where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    update: {},
    create: {
      tenantId: input.tenantId,
      departmentId: input.departmentId ?? null,
      requestId: input.requestId,
      clockId: input.clockId,
      kind: input.kind,
      runAt: input.runAt,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload ?? {},
      maxAttempts: input.maxAttempts ?? 5,
    },
  });

  if (queueEnabled()) {
    const delay = Math.max(0, input.runAt.getTime() - Date.now());
    const options: JobsOptions = {
      jobId: input.idempotencyKey,
      delay,
      attempts: input.maxAttempts ?? 5,
      backoff: { type: 'exponential', delay: 30_000 },
    };
    await getSlaTimerQueue().add(input.kind, { timerJobId: timerJob.id }, options).catch((error) => {
      logger.warn('[SLA Timer] BullMQ enqueue failed; durable DB timer remains scheduled', {
        idempotencyKey: input.idempotencyKey,
        error: String(error),
      });
    });
  }

  return timerJob;
}
